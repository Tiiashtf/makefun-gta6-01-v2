// Solmar Bay — the wanted system: stars, police cruisers that chase and ram,
// being busted on foot, heat that fades when the law loses sight of Jules,
// and Lou's Paint & Spray to buy the heat off.

import * as THREE from 'three';
import { CFG, LANDMARKS } from './config.js';
import { createCar, syncCarMesh } from './vehicles.js';

const POLICE_MODEL = { name: 'Cruiser', color: 0xf5f5f5, top: 44, accel: 24, grip: 2.5, length: 4.3 };

export function createWanted() {
  return {
    stars: 0,
    heatTimer: 0, // time since the last crime / police sighting
    bustTimer: 0,
    sprayTimer: 0,
    sprayActive: false,
  };
}

export function addWanted(G, n) {
  const w = G.wanted;
  w.stars = Math.max(0, Math.min(CFG.maxWanted, w.stars + n));
  w.heatTimer = 0;
  if (w.stars > 0) {
    G.audio.setSiren(true);
  }
}

function spawnPoliceCruiser(G) {
  const p = G.player.pos;
  // Spawn on a road a little way from Jules, facing the chase.
  const angle = Math.random() * Math.PI * 2;
  let x = p.x + Math.cos(angle) * 55;
  let z = p.z + Math.sin(angle) * 55;
  x = Math.max(-205, Math.min(205, x));
  z = Math.max(-205, Math.min(205, z));
  if (G.city.pointInBuilding(x, z)) {
    x = Math.max(-205, Math.min(205, p.x + 60));
    z = Math.max(-205, Math.min(205, p.z));
  }
  const cruiser = createCar(G.scene, POLICE_MODEL, x, z, 0, { police: true, name: 'Cruiser' });
  cruiser.speed = 10;
  G.cars.police.push(cruiser);
  G.cars.all.push(cruiser);
}

function removePoliceCruiser(G, cruiser) {
  G.scene.remove(cruiser.mesh);
  G.cars.police = G.cars.police.filter((c) => c !== cruiser);
  G.cars.all = G.cars.all.filter((c) => c !== cruiser);
}

function nearestPoliceDistance(G) {
  let best = Infinity;
  for (const cruiser of G.cars.police) {
    const d = Math.hypot(cruiser.pos.x - G.player.pos.x, cruiser.pos.z - G.player.pos.z);
    if (d < best) best = d;
  }
  return best;
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  const p = G.player;

  // Keep one cruiser per star, spawning and despawning as the heat changes.
  while (G.cars.police.length < w.stars) spawnPoliceCruiser(G);
  while (G.cars.police.length > w.stars) removePoliceCruiser(G, G.cars.police[G.cars.police.length - 1]);
  G.audio.setSiren(w.stars > 0);

  // Heat fades when no cruiser can see Jules for a while.
  if (w.stars > 0) {
    const nearest = nearestPoliceDistance(G);
    if (nearest > 45) {
      w.heatTimer += dt;
      if (w.heatTimer > CFG.heatDecaySeconds) {
        w.stars -= 1;
        w.heatTimer = 0;
        if (w.stars === 0) G.hud.showToast('The heat is off. You’re clear.');
      }
    } else {
      w.heatTimer = 0;
    }
  }

  // Cruisers chase Jules, ram the car, and bust him on foot.
  for (const cruiser of G.cars.police) {
    const dx = p.pos.x - cruiser.pos.x;
    const dz = p.pos.z - cruiser.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - cruiser.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cruiser.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Chase speed: fast from afar, but a cruiser that corners Jules on foot
    // pulls up and holds him there — that is how a bust happens.
    let targetSpeed;
    if (!p.onFoot) {
      targetSpeed = dist > 90 ? 40 : dist > 25 ? 34 : 24;
    } else if (dist < 5) {
      targetSpeed = 0;
    } else if (dist < 12) {
      targetSpeed = 8;
    } else {
      targetSpeed = dist > 90 ? 40 : 34;
    }
    cruiser.speed += (targetSpeed - cruiser.speed) * Math.min(1, dt * 1.2);
    cruiser.pos.x += Math.sin(cruiser.heading) * cruiser.speed * dt;
    cruiser.pos.z += Math.cos(cruiser.heading) * cruiser.speed * dt;
    const before = cruiser.pos.clone();
    if (G.city.collideCircle(cruiser.pos, 2.1)) cruiser.speed *= 0.7;
    // Ram: shove the player's car and slow it.
    if (p.car) {
      const cd = Math.hypot(cruiser.pos.x - p.car.pos.x, cruiser.pos.z - p.car.pos.z);
      if (cd < 4.2) {
        const push = (4.2 - cd) * 0.9;
        p.car.pos.x += ((p.car.pos.x - cruiser.pos.x) / (cd || 1)) * push;
        p.car.pos.z += ((p.car.pos.z - cruiser.pos.z) / (cd || 1)) * push;
        p.car.speed *= 0.82;
        cruiser.speed *= 0.85;
        if (Math.abs(p.car.speed) > 10) G.audio.crash();
      }
    }
    syncCarMesh(cruiser);
  }

  // Busted: on foot, a cruiser parked on Jules for 2.5 seconds ends the run.
  // (Staged screenshots set shotNoBust so the bust screen never covers a shot.)
  if (w.stars > 0 && p.onFoot && !G.shotNoBust) {
    const nearest = nearestPoliceDistance(G);
    const playerSpeed = p.moveSpeed;
    if (nearest < 4 && playerSpeed < 2) {
      w.bustTimer += dt;
      if (w.bustTimer >= CFG.bustSeconds) {
        G.game.busted(G);
        return;
      }
    } else {
      w.bustTimer = Math.max(0, w.bustTimer - dt * 2);
    }
  } else {
    w.bustTimer = 0;
  }

  // Lou's Paint & Spray: drive in with heat and money and the shop repaints
  // the car and clears the wanted level — no key needed, it is a drive-in.
  const spray = LANDMARKS.paintSpray;
  // 18 m: the shop itself pushes a car to ~15 m from its centre, so a
  // tighter zone would only trigger from the north/south approach.
  const inZone = Math.hypot(p.pos.x - spray.x, p.pos.z - spray.z) < 18;
  if (inZone && w.stars > 0 && p.car && p.money >= CFG.sprayCost) {
    w.sprayTimer += dt;
    w.sprayActive = true;
    if (w.sprayTimer > 1.5) {
      p.money -= CFG.sprayCost;
      w.stars = 0;
      w.heatTimer = 0;
      w.sprayTimer = 0;
      p.car.model = { ...p.car.model, color: 0x8e44ad };
      p.car.mesh.traverse((child) => {
        if (child.isMesh && child.material && child.material.color) {
          // Repaint only the body paint, not glass or lights.
          if (child.material.color.getHex() === p.car.color) child.material.color.setHex(0x8e44ad);
        }
      });
      p.car.color = 0x8e44ad;
      G.hud.showToast('Fresh paint, clean record. Heat cleared — $150.');
      G.audio.pickup();
    }
  } else {
    w.sprayTimer = 0;
    w.sprayActive = false;
  }
}
