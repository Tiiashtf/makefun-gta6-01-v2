// Solmar Bay — combat: fists and pistol for Jules, enforcer AI that chases
// and shoots, tracers, muzzle flash and hitmarkers.

import * as THREE from 'three';
import { CFG } from './config.js';
import { scatterNearGunshot } from './pedestrians.js';

const ENFORCER_SHIRT = 0xc0392b;

function makeEnforcerMesh(scene) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: ENFORCER_SHIRT });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.38), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.68;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.44), pants);
  cap.position.y = 1.9;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.28), pants);
  legL.position.set(-0.17, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.28), pants);
  legR.position.set(0.17, 0.33, 0);
  group.add(legR);
  // A little pistol in the right hand so the threat reads at a glance.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 0.95, 0.3);
  group.add(gun);
  scene.add(group);
  return group;
}

export function spawnEnforcers(G, x, z, count) {
  clearEnforcers(G);
  for (let i = 0; i < count; i++) {
    const mesh = makeEnforcerMesh(G.scene);
    const angle = (i / count) * Math.PI * 2;
    const ex = x + Math.cos(angle) * 9;
    const ez = z + Math.sin(angle) * 9;
    const enforcer = {
      mesh,
      pos: new THREE.Vector3(ex, 0, ez),
      heading: 0,
      health: CFG.enforcerHealth,
      shootTimer: 1 + i * 0.6,
      walkPhase: 0,
      dead: false,
      fadeTimer: 0,
    };
    mesh.position.copy(enforcer.pos);
    G.enforcers.push(enforcer);
  }
  G.hud.showToast(`${count} of Kaine’s enforcers. They shoot first.`);
}

export function clearEnforcers(G) {
  for (const e of G.enforcers) G.scene.remove(e.mesh);
  G.enforcers = [];
}

function spawnTracer(G, from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.tracers.push({ line, life: 0.09 });
}

function spawnMuzzleFlash(G, pos) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.95 }),
  );
  flash.position.copy(pos);
  G.scene.add(flash);
  G.tracers.push({ line: flash, life: 0.06, isMesh: true });
}

export function updateTracers(G, dt) {
  for (const t of G.tracers) {
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      if (t.line.geometry) t.line.geometry.dispose();
    }
  }
  G.tracers = G.tracers.filter((t) => t.life > 0);
}

// Jules punches: short reach, heavy, knocks an enforcer back.
export function playerPunch(G) {
  const p = G.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  G.audio.punch();
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  for (const e of G.enforcers) {
    if (e.dead) continue;
    const dx = e.pos.x - p.pos.x;
    const dz = e.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    const facing = (dx * fx + dz * fz) / (d || 1);
    if (d < 2.6 && facing > 0.4) {
      damageEnforcer(G, e, CFG.punchDamage);
      e.pos.x += fx * 1.2;
      e.pos.z += fz * 1.2;
    }
  }
}

// Jules shoots: a hitscan shot from the camera through the crosshair.
export function playerShoot(G) {
  const p = G.player;
  if (p.shootCooldown > 0 || p.weapon !== 'pistol') return;
  p.shootCooldown = 0.28;
  G.audio.gunshot();
  G.stats.shotsFired += 1;
  const origin = new THREE.Vector3(p.pos.x, p.pos.y + 1.5, p.pos.z);
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  // Aim flat: the camera looks down at Jules, so a raw camera ray dives into
  // the street within a few metres and can never hit anyone. Flatten it so
  // the shot goes where the crosshair points, at chest height.
  dir.y = 0;
  if (dir.lengthSq() < 0.001) dir.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  dir.normalize();
  // A little spread so it feels like a handgun, not a laser.
  dir.x += (Math.random() - 0.5) * 0.02;
  dir.y += (Math.random() - 0.5) * 0.02;
  dir.z += (Math.random() - 0.5) * 0.02;
  dir.normalize();
  const end = origin.clone().add(dir.clone().multiplyScalar(80));
  spawnMuzzleFlash(G, origin.clone().add(dir.clone().multiplyScalar(1.2)));
  spawnTracer(G, origin.clone().add(dir.clone().multiplyScalar(1.0)), end, 0xffe08a);
  scatterNearGunshot(G, p.pos.x, p.pos.z, 22);

  let best = null;
  let bestT = Infinity;
  for (const e of G.enforcers) {
    if (e.dead) continue;
    const toE = new THREE.Vector3(e.pos.x, e.pos.y + 1.1, e.pos.z).sub(origin);
    const t = toE.dot(dir);
    if (t < 1 || t > 80) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(t));
    const miss = closest.distanceTo(new THREE.Vector3(e.pos.x, e.pos.y + 1.1, e.pos.z));
    if (miss < 1.3 && t < bestT) {
      best = e;
      bestT = t;
    }
  }
  if (best) {
    G.stats.shotsHit += 1;
    G.hud.showHitmarker();
    damageEnforcer(G, best, CFG.pistolDamage);
    spawnTracer(G, origin.clone().add(dir.clone().multiplyScalar(1.0)),
      new THREE.Vector3(best.pos.x, best.pos.y + 1.1, best.pos.z), 0xffaa33);
  }
}

function damageEnforcer(G, e, amount) {
  e.health -= amount;
  // Flash the enforcer white on a hit so the player sees the damage land.
  e.mesh.traverse((child) => {
    if (child.isMesh && child.material && child.material.emissive) {
      child.material.emissive.setHex(0x662222);
      window.setTimeout(() => child.material.emissive.setHex(0x000000), 90);
    }
  });
  if (e.health <= 0 && !e.dead) {
    e.dead = true;
    e.fadeTimer = 1.6;
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.3;
    G.player.money += 50;
    G.hud.showToast('Enforcer down. +$50 off the street.');
    G.audio.pickup();
  }
}

// Enforcer AI: close to shooting range, then stand and fire with poor aim.
export function updateEnforcers(G, dt) {
  const p = G.player;
  for (const e of G.enforcers) {
    if (e.dead) {
      e.fadeTimer -= dt;
      if (e.fadeTimer <= 0) {
        G.scene.remove(e.mesh);
        G.enforcers = G.enforcers.filter((x) => x !== e);
      }
      continue;
    }
    const dx = p.pos.x - e.pos.x;
    const dz = p.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    e.heading = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.heading;
    if (dist > 16) {
      e.pos.x += (dx / dist) * 4.6 * dt;
      e.pos.z += (dz / dist) * 4.6 * dt;
      e.walkPhase += dt * 9;
      const swing = Math.sin(e.walkPhase) * 0.4;
      e.mesh.position.y = Math.abs(Math.sin(e.walkPhase)) * 0.05;
      void swing;
    } else {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.2 + Math.random() * 0.9;
        const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.3, e.pos.z);
        const to = new THREE.Vector3(p.pos.x, p.pos.y + 1.1, p.pos.z);
        spawnTracer(G, from, to, 0xff5544);
        G.audio.enemyShot();
        // Rough aim: about one shot in three lands.
        if (Math.random() < 0.35) {
          damagePlayer(G, CFG.enforcerShotDamage);
          G.hud.flashDamage();
        }
      }
    }
    G.city.collideCircle(e.pos, 0.6);
    e.mesh.position.set(e.pos.x, e.mesh.position.y, e.pos.z);
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  p.health -= amount;
  p.lastDamageAt = G.time;
  if (p.health <= 0) {
    p.health = 0;
    G.game.wasted(G);
  }
}
