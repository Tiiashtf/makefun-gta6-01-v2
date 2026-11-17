// Solmar Bay — cars: box-built bodies with wheels and headlights, the parked
// cars Jules can steal, the Comet GT, Kaine's limo, and the traffic that
// follows the road grid and turns at intersections.

import * as THREE from 'three';
import { CFG, CAR_MODELS, ROAD_LINES } from './config.js';
import { makeRng } from './random.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);

export function makeCarMesh(model, opts) {
  const o = opts || {};
  const group = new THREE.Group();
  group.name = o.name || model.name;
  const paint = new THREE.MeshLambertMaterial({ color: o.color || model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const trim = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const len = model.length;
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(1.9, 0.62, len);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(bodyGeo, glass);
  cabin.scale.set(1.6, 0.55, len * 0.45);
  cabin.position.set(0, 1.1, -len * 0.06);
  group.add(cabin);
  const hood = new THREE.Mesh(bodyGeo, paint);
  hood.scale.set(1.86, 0.18, len * 0.2);
  hood.position.set(0, 0.92, len * 0.38);
  group.add(hood);
  // Wheels.
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheelSpots = [
    [-0.85, len * 0.32], [0.85, len * 0.32], [-0.85, -len * 0.32], [0.85, -len * 0.32],
  ];
  for (const [wx, wz] of wheelSpots) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
  }
  // Headlights and tail lights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x998800 });
  for (const side of [-0.6, 0.6]) {
    const head = new THREE.Mesh(bodyGeo, headMat);
    head.scale.set(0.34, 0.16, 0.08);
    head.position.set(side, 0.62, len / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x550000 }));
    tail.scale.set(0.34, 0.16, 0.08);
    tail.position.set(side, 0.62, -len / 2 - 0.02);
    group.add(tail);
  }
  // Police light bar on cruisers.
  if (o.police) {
    const bar = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.scale.set(1.1, 0.16, 0.4);
    bar.position.set(0, 1.44, 0);
    group.add(bar);
    const red = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.scale.set(0.5, 0.18, 0.42);
    red.position.set(-0.28, 1.46, 0);
    group.add(red);
    const blue = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0022aa }));
    blue.scale.set(0.5, 0.18, 0.42);
    blue.position.set(0.28, 1.46, 0);
    group.add(blue);
  }
  // Blob shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, len + 0.8),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  return group;
}

// A car in the world: mesh + arcade state. heading 0 faces -z (north).
export function createCar(scene, model, x, z, heading, opts) {
  const mesh = makeCarMesh(model, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    model,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    parked: !!(opts && opts.parked),
    stolen: false,
    police: !!(opts && opts.police),
    limo: !!(opts && opts.limo),
    name: (opts && opts.name) || model.name,
    health: 100,
    color: (opts && opts.color) || model.color,
    flashUntil: 0,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
}

// --- Traffic: cars that follow the road grid, turning at intersections. -----
// Right-hand lane offset: +3 when driving east or north, -3 when west/south.
export function laneSide(axis, dir) {
  return (axis === 'x' ? 1 : -1) * (dir === 1 ? 3 : -3);
}

export function createTraffic(G) {
  const rng = makeRng(CFG.seed + 77);
  const cars = [];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const model = CAR_MODELS[1 + (i % (CAR_MODELS.length - 1))];
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(ROAD_LINES);
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-200, 200);
    const side = laneSide(axis, dir);
    const car = createCar(G.scene, model,
      axis === 'x' ? along : road + side,
      axis === 'x' ? road + side : along,
      axis === 'x' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI));
    car.traffic = { axis, dir, along, road, speed: rng.range(9, 15) };
    cars.push(car);
  }
  return cars;
}

function nextRoadLine(along, dir) {
  if (dir === 1) {
    for (const line of ROAD_LINES) if (line > along + 0.5) return line;
    return null;
  }
  for (let i = ROAD_LINES.length - 1; i >= 0; i--) {
    if (ROAD_LINES[i] < along - 0.5) return ROAD_LINES[i];
  }
  return null;
}

export function updateTraffic(G, dt) {
  const rng = G.trafficRng;
  for (const car of G.cars.traffic) {
    const t = car.traffic;
    let speed = t.speed;
    // Slow down for the car ahead on the same road.
    for (const other of G.cars.traffic) {
      if (other === car || other.traffic.axis !== t.axis || other.traffic.road !== t.road) continue;
      const gap = (other.traffic.along - t.along) * t.dir;
      if (gap > 0 && gap < 10) speed = Math.min(speed, 4);
    }
    // And for the player car blocking the road.
    if (G.player.car) {
      const pc = G.player.car;
      const along = t.axis === 'x' ? pc.pos.x : pc.pos.z;
      const perp = t.axis === 'x' ? pc.pos.z : pc.pos.x;
      const gap = (along - t.along) * t.dir;
      if (Math.abs(perp - t.road) < 5 && gap > 0 && gap < 11) speed = Math.min(speed, 2);
    }
    t.along += t.dir * speed * dt;
    const edge = 210;
    if (t.along > edge || t.along < -edge) {
      // U-turn at the edge of the bay: flip direction, the lane side flips too.
      t.dir *= -1;
      t.along = Math.max(-edge, Math.min(edge, t.along));
    }
    const crossing = nextRoadLine(t.along - t.dir * speed * dt, t.dir);
    if (crossing !== null && ((t.dir === 1 && t.along >= crossing) || (t.dir === -1 && t.along <= crossing))) {
      // At an intersection: mostly straight on, sometimes turn.
      const roll = rng.next();
      if (roll < 0.16) {
        const turnLeft = rng.chance(0.5);
        const newDir = t.dir === 1 ? (turnLeft ? -1 : 1) : (turnLeft ? 1 : -1);
        // New road is the one just crossed; new direction along the old road.
        const oldRoad = t.road;
        t.axis = t.axis === 'x' ? 'z' : 'x';
        t.road = crossing;
        t.along = oldRoad;
        t.dir = newDir;
      }
    }
    const side = laneSide(t.axis, t.dir);
    if (t.axis === 'x') {
      car.pos.x = t.along;
      car.pos.z = t.road + side;
      car.heading = t.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.x = t.road + side;
      car.pos.z = t.along;
      car.heading = t.dir === 1 ? 0 : Math.PI;
    }
    syncCarMesh(car);
  }
}

// --- Parked cars Jules can steal, including the Comet GT. ------------------
export function createParkedCars(G) {
  const rng = makeRng(CFG.seed + 31);
  const spots = [
    { x: -104, z: -130, model: CAR_MODELS[0], name: 'Comet GT', comet: true },
    { x: 52, z: -100, model: CAR_MODELS[4] },
    { x: -156, z: 56, model: CAR_MODELS[1] },
    { x: 104, z: 26, model: CAR_MODELS[5] },
    { x: -52, z: 156, model: CAR_MODELS[2] },
    { x: 156, z: -156, model: CAR_MODELS[3] },
    { x: -26, z: -52, model: CAR_MODELS[4] },
    { x: 130, z: 104, model: CAR_MODELS[1] },
  ];
  const cars = [];
  for (const spot of spots) {
    const heading = rng.chance(0.5) ? Math.PI / 2 : 0;
    const car = createCar(G.scene, spot.model, spot.x, spot.z, heading, {
      parked: true, name: spot.name || spot.model.name,
    });
    car.comet = !!spot.comet;
    cars.push(car);
  }
  return cars;
}

// Kaine's limo: a long black car that loops the central ring road. Its route is
// a perimeter parameter s around the square with corners (±104, ±104).
export function createLimo(G) {
  const limoModel = { name: 'Kaine Limo', color: 0x0d0d12, top: 40, accel: 16, grip: 2.0, length: 6.4 };
  const limo = createCar(G.scene, limoModel, 0, -104, Math.PI / 2, { limo: true, name: 'Kaine Limo' });
  limo.loopS = 104; // perimeter distance along the ring
  limo.fleeing = false;
  limo.active = false;
  limo.mesh.visible = false;
  return limo;
}

function ringPosition(s) {
  // Perimeter 832 = 4 sides of 208. Corners: (-104,-104) -> (104,-104) ->
  // (104,104) -> (-104,104) -> back. Heading faces along the side.
  const side = 208;
  const t = ((s % 832) + 832) % 832;
  if (t < side) return { x: -104 + t, z: -104, heading: Math.PI / 2 };
  if (t < side * 2) return { x: 104, z: -104 + (t - side), heading: 0 };
  if (t < side * 3) return { x: 104 - (t - side * 2), z: 104, heading: -Math.PI / 2 };
  return { x: -104, z: 104 - (t - side * 3), heading: 0 };
}

export function updateLimo(G, dt) {
  const limo = G.cars.limo;
  if (!limo || !limo.active) return;
  const speed = limo.fleeing ? 27 : 17;
  limo.loopS += speed * dt;
  const p = ringPosition(limo.loopS);
  limo.pos.x = p.x;
  limo.pos.z = p.z;
  limo.heading = p.heading;
  syncCarMesh(limo);
}
