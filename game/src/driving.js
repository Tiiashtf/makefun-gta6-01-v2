// Solmar Bay — arcade driving: accel, brake, reverse, handbrake slides,
// building and car collisions, entering and exiting cars, stealing them.

import * as THREE from 'three';
import { CFG } from './config.js';
import { syncCarMesh } from './vehicles.js';

export function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars.all) {
    if (car.police || car.limo) continue;
    if (car === G.player.car) continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.car = car;
  p.onFoot = false;
  car.parked = false;
  p.mesh.visible = false;
  if (car.comet && !car.stolen) {
    car.stolen = true;
    G.stats.carsStolen += 1;
    G.wanted.addWanted(G, 1);
    if (G.mission.index === 1 && G.mission.stage === 'steal') {
      G.missions.setStage(G, 'deliver');
      G.hud.showToast('Comet GT taken! Deliver it to Mara’s Garage.');
    }
  } else if (!car.stolen && car.parked) {
    car.stolen = true;
    G.stats.carsStolen += 1;
    G.wanted.addWanted(G, 1);
    G.hud.showToast(`You took the ${car.name}. The law noticed.`);
  }
  G.audio.ensure();
  G.audio.pickup();
  // Face the camera behind the car as Jules gets in.
  G.camYaw = car.heading + Math.PI;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  const sideX = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  p.pos.set(car.pos.x + sideX * 2.2, 0, car.pos.z + sideZ * 2.2);
  G.city.collideCircle(p.pos, 0.7);
  p.heading = car.heading;
  p.car = null;
  p.onFoot = true;
  p.mesh.visible = true;
  G.camYaw = car.heading + Math.PI;
}

function collideCarWithWorld(G, car, dt) {
  // Buildings: slide along them and scrub speed.
  const before = car.pos.clone();
  if (G.city.collideCircle(car.pos, 2.1)) {
    const moved = Math.hypot(car.pos.x - before.x, car.pos.z - before.z);
    if (moved > 0.01) {
      car.speed *= 0.55;
      if (Math.abs(car.speed) > 6 && G.audio) G.audio.crash();
      G.hud.flashDamage();
    }
  }
  // Other cars: bounce off each other. The limo only counts while active
  // (mission 6); before that it is invisible at its ring-road start.
  for (const other of G.cars.all) {
    if (other === car) continue;
    if (other.limo && !other.active) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const d = Math.hypot(dx, dz);
    const minD = 4.4;
    if (d < minD && d > 0.001) {
      const push = (minD - d) / 2;
      car.pos.x += (dx / d) * push;
      car.pos.z += (dz / d) * push;
      if (!other.police && !other.traffic) {
        other.pos.x -= (dx / d) * push;
        other.pos.z -= (dz / d) * push;
        syncCarMesh(other);
      }
      if (Math.abs(car.speed) > 8) {
        car.speed *= 0.6;
        if (other.limo) {
          G.missions.onLimoRam(G, car);
        } else if (G.audio) {
          G.audio.crash();
        }
      }
    }
  }
  // Pedestrians: a hit at speed scatters them and draws the law.
  for (const ped of G.pedestrians) {
    if (ped.fled) continue;
    const dx = car.pos.x - ped.pos.x;
    const dz = car.pos.z - ped.pos.z;
    if (Math.hypot(dx, dz) < 2.6) {
      ped.scatter(G, dx, dz);
      if (Math.abs(car.speed) > 5) G.wanted.addWanted(G, 1);
    }
  }
  // Stay in the bay.
  car.pos.x = Math.max(-262, Math.min(262, car.pos.x));
  car.pos.z = Math.max(-262, Math.min(276, car.pos.z));
}

export function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const keys = G.keys;
  const model = car.model;
  const forward = keys.KeyW || keys.ArrowUp;
  const back = keys.KeyS || keys.ArrowDown;
  const left = keys.KeyA || keys.ArrowLeft;
  const right = keys.KeyD || keys.ArrowRight;
  const handbrake = keys.Space;

  // Steering: sharper at low speed, and reversed when reversing.
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  const steerMax = 0.55 * Math.max(0.35, 1 - Math.abs(car.speed) / (model.top * 1.4));
  car.steer += (steerTarget * steerMax - car.steer) * Math.min(1, dt * 8);
  if (handbrake) car.steer *= 1.25;

  if (forward) {
    car.speed += model.accel * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (back) {
    if (car.speed > 0.5) car.speed -= model.accel * 1.6 * dt; // brake
    else car.speed -= model.accel * 0.7 * dt; // reverse
  } else {
    car.speed -= car.speed * 0.9 * dt; // coast drag
  }
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  car.speed = Math.max(-model.top * 0.45, Math.min(model.top, car.speed));

  const turnRate = car.steer * (car.speed / model.top) * 2.6 * (handbrake ? 1.5 : 1);
  car.heading += turnRate * dt * (car.speed < 0 ? -1 : 1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  collideCarWithWorld(G, car, dt);
  syncCarMesh(car);
  p.pos.copy(car.pos);
  G.audio.setEngine(Math.abs(car.speed) / model.top, true);
}
