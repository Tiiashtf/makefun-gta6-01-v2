// Solmar Bay — builds the whole city from a seed: ground texture with roads,
// ~120 buildings with lit-window facades, beach and sea, pier and lighthouse,
// marina boats, palms, streetlights and named landmark signs. Exports the
// collision boxes and landmark positions the other systems use.

import * as THREE from 'three';
import { CFG, LANDMARKS, PALETTE, ROAD_LINES, blockCentre } from './config.js';
import { makeRng } from './random.js';

const BUILDING_HUES = [0xc9a06a, 0x9fb4c7, 0xd8cfc0, 0xb08d7e, 0x8fa98f, 0xc7b299];

function makeFacadeTexture(rng, hue) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(hue);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shading so towers read from a distance.
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  // Window grid, some lit warm, some dark glass.
  const cols = 4 + rng.int(0, 2);
  const rows = 8 + rng.int(0, 4);
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.chance(0.28);
      ctx.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? '#2c3e50' : '#40586e');
      ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture(rng) {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const worldToPx = (v) => ((v + 300) / 600) * size;
  const px = (v) => (v / 600) * size;

  // Base: sun-baked grass and bare lots.
  ctx.fillStyle = '#a8b078';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(2, 9), rng.range(2, 9));
  }
  // Beach sand along the south edge, then the shore.
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, worldToPx(CFG.beachStartZ), size, worldToPx(CFG.seaStartZ) - worldToPx(CFG.beachStartZ));
  ctx.fillStyle = '#f2e3b3';
  ctx.fillRect(0, worldToPx(CFG.seaStartZ - 6), size, px(6));

  // Sidewalk aprons around every block.
  ctx.fillStyle = '#b9b3a4';
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      const cx = blockCentre(bx);
      const cz = blockCentre(bz);
      ctx.fillRect(worldToPx(cx - 26), worldToPx(cz - 26), px(52), px(52));
    }
  }

  // Roads: dark asphalt with centre dashes and crosswalk stripes.
  for (const line of ROAD_LINES) {
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(worldToPx(line - 6), 0, px(12), size);
    ctx.fillRect(0, worldToPx(line - 6), size, px(12));
  }
  ctx.fillStyle = '#e8c33c';
  for (const line of ROAD_LINES) {
    for (let v = -280; v < 280; v += 16) {
      ctx.fillRect(worldToPx(v), worldToPx(line - 0.6), px(8), px(1.2));
      ctx.fillRect(worldToPx(line - 0.6), worldToPx(v), px(1.2), px(8));
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      for (let s = -5; s <= 5; s += 2.5) {
        ctx.fillRect(worldToPx(lx + s - 0.8), worldToPx(lz - 6), px(1.6), px(3));
        ctx.fillRect(worldToPx(lx + s - 0.8), worldToPx(lz + 3), px(1.6), px(3));
        ctx.fillRect(worldToPx(lx - 6), worldToPx(lz + s - 0.8), px(3), px(1.6));
        ctx.fillRect(worldToPx(lx + 3), worldToPx(lz + s - 0.8), px(3), px(1.6));
      }
    }
  }
  // Sun Plaza: pale stone circle at its block.
  ctx.fillStyle = '#d8cfb8';
  ctx.beginPath();
  ctx.arc(worldToPx(LANDMARKS.sunPlaza.x), worldToPx(LANDMARKS.sunPlaza.z), px(24), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b09a6a';
  ctx.lineWidth = px(1);
  ctx.beginPath();
  ctx.arc(worldToPx(LANDMARKS.sunPlaza.x), worldToPx(LANDMARKS.sunPlaza.z), px(14), 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeTextSprite(text, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,28,38,0.72)';
  ctx.beginPath();
  ctx.roundRect(6, 14, 500, 68, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(22 * (scale || 1), 4.1 * (scale || 1), 1);
  return sprite;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.2, 6), trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.4, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  return group;
}

// Blocks that stay open: Sun Plaza, the Docks yard, the pier approach.
function isOpenBlock(bx, bz) {
  if (bx === 0 && bz === 0) return true; // Sun Plaza
  if (bx === 7 && bz === 6) return true; // Docks yard (near beach, east)
  return false;
}

export function buildCity(scene) {
  const rng = makeRng(CFG.seed);
  const group = new THREE.Group();
  group.name = 'SolmarBayCity';
  scene.add(group);

  const colliders = [];
  const facadeTextures = BUILDING_HUES.map((hue) => makeFacadeTexture(rng, hue));
  const facadeMaterials = facadeTextures.map(
    (tex) => new THREE.MeshLambertMaterial({ map: tex }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // Ground plane with the painted street map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  group.add(ground);

  // Sea: a wide blue plane south of the beach, gently bobbing.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 420),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.4, CFG.seaStartZ + 200);
  group.add(sea);

  // Buildings, block by block. A tall tower marks the Glass Spire block.
  let buildingCount = 0;
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      if (isOpenBlock(bx, bz)) continue;
      const cx = blockCentre(bx);
      const cz = blockCentre(bz);
      const isSpire = bx === 1 && bz === 1;
      const isWarehouse = bx === 6 && bz === 2;
      const isGarage = bx === 4 && bz === 6;
      const isCafe = bx === 5 && bz === 7;
      const isGeneral = bx === 5 && bz === 3;
      const isPaint = bx === 1 && bz === 5;
      const lots = isSpire || isWarehouse || isGarage || isCafe || isGeneral || isPaint
        ? [{ dx: 0, dz: 0, w: 30, d: 26 }]
        : [
            { dx: -9, dz: -8, w: 16, d: 15 },
            { dx: 9, dz: 8, w: 15, d: 14 },
          ];
      if (!isSpire && !isWarehouse && rng.chance(0.35)) {
        lots.push({ dx: 9, dz: -9, w: 12, d: 11 });
      }
      for (const lot of lots) {
        const w = lot.w;
        const d = lot.d;
        const h = isSpire ? 92 : isWarehouse ? 12 : rng.range(8, 34);
        const x = cx + lot.dx;
        const z = cz + lot.dz;
        const mat = facadeMaterials[rng.int(0, facadeMaterials.length - 1)];
        const mesh = new THREE.Mesh(boxGeo, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w * 0.5, 1.2, d * 0.5);
        roof.position.set(x, h + 0.6, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        buildingCount += 1;
        if (isSpire) {
          // Glass Spire: a glowing crown so it reads from anywhere.
          const crown = new THREE.Mesh(
            boxGeo,
            new THREE.MeshLambertMaterial({ color: 0x7fd4ff, emissive: 0x2a6a8a }),
          );
          crown.scale.set(w * 0.6, 4, d * 0.6);
          crown.position.set(x, h + 2.6, z);
          group.add(crown);
        }
      }
    }
  }

  // Sun Plaza fountain.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.6, 1.4, 20),
    new THREE.MeshLambertMaterial({ color: 0xcfc4a8 }),
  );
  fountain.position.set(LANDMARKS.sunPlaza.x, 0.7, LANDMARKS.sunPlaza.z);
  group.add(fountain);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 0.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x3fa8d8 }),
  );
  fountainWater.position.set(LANDMARKS.sunPlaza.x, 1.5, LANDMARKS.sunPlaza.z);
  group.add(fountainWater);
  colliders.push({
    minX: LANDMARKS.sunPlaza.x - 5.6, maxX: LANDMARKS.sunPlaza.x + 5.6,
    minZ: LANDMARKS.sunPlaza.z - 5.6, maxZ: LANDMARKS.sunPlaza.z + 5.6,
  });

  // Palms: along the beach and scattered on sidewalks.
  const palmSpots = [];
  for (let x = -260; x <= 260; x += 26) palmSpots.push([x + rng.range(-4, 4), CFG.beachStartZ + rng.range(6, 18)]);
  for (let i = 0; i < 26; i++) {
    palmSpots.push([rng.pick(ROAD_LINES) + rng.pick([-9, 9]), rng.pick(ROAD_LINES) + rng.pick([-9, 9])]);
  }
  for (const [px, pz] of palmSpots) {
    const palm = makePalm(rng);
    palm.position.set(px, 0, pz);
    group.add(palm);
  }

  // Streetlights at every other intersection.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xccaa44 });
  const bulbs = [];
  for (let ix = 0; ix < ROAD_LINES.length; ix += 2) {
    for (let iz = 0; iz < ROAD_LINES.length; iz += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(ROAD_LINES[ix] + 6.4, 3, ROAD_LINES[iz] + 6.4);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(ROAD_LINES[ix] + 6.4, 6.1, ROAD_LINES[iz] + 6.4);
      group.add(bulb);
      bulbs.push(bulb);
    }
  }

  // Pier: planks out into the sea, lighthouse at the end, marina boats nearby.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7b52 });
  for (let z = CFG.seaStartZ - 2; z <= 350; z += 4) {
    const plank = new THREE.Mesh(boxGeo, pierMat);
    plank.scale.set(10, 0.6, 3.6);
    plank.position.set(LANDMARKS.pier.x, 0.9, z);
    group.add(plank);
  }
  for (let z = CFG.seaStartZ + 4; z <= 348; z += 16) {
    for (const side of [-4.6, 4.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6), pierMat);
      post.position.set(LANDMARKS.pier.x + side, 0.4, z);
      group.add(post);
    }
  }
  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 22, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  tower.position.y = 11;
  lighthouse.add(tower);
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.7, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0xd7263d }),
  );
  stripe.position.y = 14;
  lighthouse.add(stripe);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdd55 }),
  );
  lamp.position.y = 23;
  lighthouse.add(lamp);
  lighthouse.position.set(LANDMARKS.lighthouse.x, 0.6, LANDMARKS.lighthouse.z);
  group.add(lighthouse);
  colliders.push({
    minX: LANDMARKS.lighthouse.x - 3.4, maxX: LANDMARKS.lighthouse.x + 3.4,
    minZ: LANDMARKS.lighthouse.z - 3.4, maxZ: LANDMARKS.lighthouse.z + 3.4,
  });

  // Marina boats bobbing near the pier.
  const boatHullMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const boatTrimMat = new THREE.MeshLambertMaterial({ color: 0x2e86de });
  const boats = [];
  for (let i = 0; i < 7; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, boatHullMat);
    hull.scale.set(3.2, 1.1, 8);
    hull.position.y = 0.6;
    boat.add(hull);
    const cabin = new THREE.Mesh(boxGeo, boatTrimMat);
    cabin.scale.set(2.2, 1.2, 3);
    cabin.position.set(0, 1.6, -0.5);
    boat.add(cabin);
    boat.position.set(LANDMARKS.pier.x - 26 + i * 9, 0.2, CFG.seaStartZ + 26 + (i % 3) * 14);
    boat.rotation.y = rng.range(-0.2, 0.2);
    group.add(boat);
    boats.push(boat);
  }

  // Landmark name signs floating above the key places.
  const signSpots = [
    [LANDMARKS.sunPlaza, 9],
    [LANDMARKS.marasGarage, 10],
    [LANDMARKS.kaineWarehouse, 10],
    [LANDMARKS.docks, 10],
    [LANDMARKS.harborCafe, 9],
    [LANDMARKS.paintSpray, 10],
    [LANDMARKS.solmarGeneral, 10],
    [LANDMARKS.glassSpire, 96],
  ];
  for (const [lm, height] of signSpots) {
    const sprite = makeTextSprite(lm.label, 1);
    sprite.position.set(lm.x, height, lm.z);
    group.add(sprite);
  }

  // Push a circle out of every building box. Returns true when a push happened.
  function collideCircle(pos, radius) {
    let pushed = false;
    for (const box of colliders) {
      const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          pos.x = cx + (dx / dist) * radius;
          pos.z = cz + (dz / dist) * radius;
        } else {
          // Centre inside the box: shove out along the smallest penetration.
          const pushLeft = pos.x - box.minX;
          const pushRight = box.maxX - pos.x;
          const pushUp = pos.z - box.minZ;
          const pushDown = box.maxZ - pos.z;
          const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
          if (min === pushLeft) pos.x = box.minX - radius;
          else if (min === pushRight) pos.x = box.maxX + radius;
          else if (min === pushUp) pos.z = box.minZ - radius;
          else pos.z = box.maxZ + radius;
        }
        pushed = true;
      }
    }
    return pushed;
  }

  function pointInBuilding(x, z) {
    for (const box of colliders) {
      if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return true;
    }
    return false;
  }

  // Gentle idle motion: sea shimmer and the lighthouse beam.
  function updateCity(dt, time) {
    sea.position.y = 0.4 + Math.sin(time * 0.7) * 0.15;
    for (let i = 0; i < boats.length; i++) {
      boats[i].position.y = 0.2 + Math.sin(time * 0.9 + i * 1.7) * 0.18;
      boats[i].rotation.z = Math.sin(time * 0.6 + i) * 0.02;
    }
    lamp.material.emissiveIntensity = 0.8 + Math.sin(time * 2.2) * 0.4;
  }

  return {
    group,
    colliders,
    buildingCount,
    collideCircle,
    pointInBuilding,
    updateCity,
    sea,
    bulbs,
  };
}
