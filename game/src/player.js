// Solmar Bay — Jules Vane on foot: third-person movement, a little animated
// figure, and the orbit camera (which becomes the chase camera while driving).

import * as THREE from 'three';
import { CFG } from './config.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  group.name = 'JulesVane';
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.68;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), hair);
  hairMesh.position.y = 1.92;
  group.add(hairMesh);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.28), jeans);
  legL.position.set(-0.17, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.28), jeans);
  legR.position.set(0.17, 0.33, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.22), jacket);
  armL.position.set(-0.42, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.22), jacket);
  armR.position.set(0.42, 1.05, 0);
  group.add(armR);

  // A soft blob shadow so Jules reads on the ground from any angle.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  scene.add(group);
  return {
    mesh: group,
    legL,
    legR,
    armL,
    armR,
    pos: new THREE.Vector3(0, 0, 0),
    heading: 0, // radians, 0 = facing -z (north)
    moveSpeed: 0,
    walkPhase: 0,
    health: CFG.playerMaxHealth,
    money: 0,
    weapon: 'fists', // or 'pistol'
    onFoot: true,
    car: null,
    lastDamageAt: -99,
    punchCooldown: 0,
    shootCooldown: 0,
  };
}

// WASD moves relative to the camera yaw; Shift runs; legs swing with the stride.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const keys = G.keys;
  const fwdX = -Math.sin(G.camYaw);
  const fwdZ = -Math.cos(G.camYaw);
  const rightX = Math.cos(G.camYaw);
  const rightZ = -Math.sin(G.camYaw);
  let mx = 0;
  let mz = 0;
  if (keys.KeyW) { mx += fwdX; mz += fwdZ; }
  if (keys.KeyS) { mx -= fwdX; mz -= fwdZ; }
  if (keys.KeyD) { mx += rightX; mz += rightZ; }
  if (keys.KeyA) { mx -= rightX; mz -= rightZ; }
  const moving = mx !== 0 || mz !== 0;
  const running = keys.ShiftLeft || keys.ShiftRight;
  const speed = running ? CFG.runSpeed : CFG.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.heading = Math.atan2(mx, mz);
    p.moveSpeed = speed;
    p.walkPhase += dt * (running ? 11 : 8);
  } else {
    p.moveSpeed = 0;
  }
  // Stay in the bay: streets, beach and pier, never the open sea.
  p.pos.x = Math.max(-262, Math.min(262, p.pos.x));
  p.pos.z = Math.max(-262, Math.min(348, p.pos.z));
  G.city.collideCircle(p.pos, 0.7);
  // Soft push away from cars so Jules cannot clip through one. The limo only
  // counts while it is active (mission 6): before that it is parked invisible
  // at its ring-road start and must not block the street.
  for (const car of G.cars.all) {
    if (car.limo && !car.active) continue;
    const dx = p.pos.x - car.pos.x;
    const dz = p.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.4 && d > 0.001) {
      p.pos.x = car.pos.x + (dx / d) * 2.4;
      p.pos.z = car.pos.z + (dz / d) * 2.4;
    }
  }
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.7;
  p.armR.rotation.x = swing * 0.7;
  p.mesh.visible = true;
}

// Orbit on foot; chase behind the car while driving. Mouse drag orbits,
// wheel zooms, and the camera never dips under the street.
export function updateCamera(G, dt) {
  const cam = G.camera;
  const p = G.player;
  let target;
  let yaw;
  let pitch = G.camPitch;
  let dist = G.camDist;
  if (p.onFoot) {
    target = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    yaw = G.camYaw;
  } else if (p.car) {
    // Chase cam: ease behind the car's heading, slightly above the roof.
    // camYaw sits opposite the car's heading so the camera trails behind it.
    const behindYaw = p.car.heading + Math.PI;
    let diff = behindYaw - G.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.camYaw += diff * Math.min(1, dt * 2.2);
    yaw = G.camYaw;
    pitch = Math.max(pitch, -0.08);
    dist = Math.max(dist, 9);
    target = new THREE.Vector3(p.car.pos.x, 1.8, p.car.pos.z);
  } else {
    target = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    yaw = G.camYaw;
  }
  const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cy = target.y + Math.sin(pitch) * dist + 1.2;
  const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
  const desired = new THREE.Vector3(cx, Math.max(cy, 1.4), cz);
  cam.position.lerp(desired, Math.min(1, dt * 10));
  cam.lookAt(target);
}
