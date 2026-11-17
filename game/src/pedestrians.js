// Solmar Bay — pedestrians: locals who stroll the sidewalks and scatter when
// a car bears down on them or a gun goes off nearby.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22, 0xfd79a8];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037];

function makePedestrianMesh(scene, rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), shirt);
  torso.position.y = 1.0;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
  head.position.y = 1.58;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.26), pants);
  legL.position.set(-0.15, 0.31, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.26), pants);
  legR.position.set(0.15, 0.31, 0);
  group.add(legR);
  scene.add(group);
  return { mesh: group, legL, legR };
}

export function createPedestrians(G) {
  const rng = makeRng(CFG.seed + 55);
  const peds = [];
  for (let i = 0; i < CFG.pedestrianCount; i++) {
    const parts = makePedestrianMesh(G.scene, rng);
    const x = rng.range(-200, 200);
    const z = rng.range(-200, 210);
    const ped = {
      mesh: parts.mesh,
      legL: parts.legL,
      legR: parts.legR,
      pos: new THREE.Vector3(x, 0, z),
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      target: new THREE.Vector3(rng.range(-200, 200), 0, rng.range(-200, 210)),
      walkPhase: rng.range(0, 6),
      fled: false,
      fleeTimer: 0,
      fleeX: 0,
      fleeZ: 0,
      scatter(G, fromX, fromZ) {
        this.fled = true;
        this.fleeTimer = 3;
        const dx = this.pos.x - fromX;
        const dz = this.pos.z - fromZ;
        const d = Math.hypot(dx, dz) || 1;
        this.fleeX = dx / d;
        this.fleeZ = dz / d;
      },
    };
    ped.mesh.position.copy(ped.pos);
    peds.push(ped);
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  for (const ped of G.pedestrians) {
    let moving = true;
    if (ped.fled) {
      ped.fleeTimer -= dt;
      ped.pos.x += ped.fleeX * 6.5 * dt;
      ped.pos.z += ped.fleeZ * 6.5 * dt;
      ped.heading = Math.atan2(ped.fleeX, ped.fleeZ);
      if (ped.fleeTimer <= 0) ped.fled = false;
    } else {
      const dx = ped.target.x - ped.pos.x;
      const dz = ped.target.z - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        // Pick a new strolling destination on a sidewalk near a road.
        const rng = G.pedRng;
        ped.target.set(rng.range(-200, 200), 0, rng.range(-200, 210));
        moving = false;
      } else {
        ped.pos.x += (dx / dist) * ped.speed * dt;
        ped.pos.z += (dz / dist) * ped.speed * dt;
        ped.heading = Math.atan2(dx, dz);
      }
    }
    // Fleeing pedestrians run from a nearby speeding car or a gunshot.
    const playerCar = G.player.car;
    if (playerCar && Math.abs(playerCar.speed) > 6) {
      const d = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
      if (d < 9 && !ped.fled) ped.scatter(G, playerCar.pos.x, playerCar.pos.z);
    }
    ped.pos.x = Math.max(-255, Math.min(255, ped.pos.x));
    ped.pos.z = Math.max(-255, Math.min(270, ped.pos.z));
    G.city.collideCircle(ped.pos, 0.6);
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.heading;
    if (moving) {
      ped.walkPhase += dt * (ped.fled ? 13 : 6);
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
    } else {
      ped.legL.rotation.x = 0;
      ped.legR.rotation.x = 0;
    }
  }
}

// Every pedestrian within earshot runs when a shot is fired.
export function scatterNearGunshot(G, x, z, radius) {
  for (const ped of G.pedestrians) {
    const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
    if (d < radius && !ped.fled) ped.scatter(G, x, z);
  }
}
