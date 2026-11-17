// Solmar Bay — deterministic screenshot staging. ?shot=cover|street|mission|
// finale (with ?seed=) puts the game straight into a composed scene so the
// screenshots are reproducible: car getaway, street life, dock gunfight, and
// the limo finale at dusk. ?shot= also skips the title screen.

import * as THREE from 'three';
import { LANDMARKS } from './config.js';

export function parseShotParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot'),
    seed: params.get('seed') || '20261117',
  };
}

function putPlayerInCar(G, car, speed) {
  G.driving.enterCar(G, car);
  car.speed = speed || 0;
  G.camYaw = car.heading + Math.PI;
  G.camPitch = 0.16;
  G.camDist = 11;
}

// Place Jules, the camera and the world for one named shot.
export function applyShotStaging(G, shot) {
  if (!shot) return false;
  const p = G.player;
  G.audio.setMuted(true);
  G.state = 'playing';
  G.hud.showOverlay(null);
  G.hud.showToast('');

  if (shot === 'cover') {
    // Getaway: Jules in the Comet GT, three stars, cruisers closing in.
    // On the z=-52 road heading east, throttle held, so the car stays moving.
    const comet = G.cars.comet;
    comet.pos.set(-104, 0, -52);
    comet.heading = Math.PI / 2;
    comet.parked = false;
    p.pos.set(-104, 0, -52);
    putPlayerInCar(G, comet, 26);
    G.shotDrive = true;
    G.camDist = 12;
    G.wanted.stars = 3;
    G.audio.setSiren(true);
    G.missions.startMission(G, 1);
    G.mission.stage = 'deliver';
    G.missions.setWaypoint(G, LANDMARKS.marasGarage.x, LANDMARKS.marasGarage.z);
    G.hud.showObjective('Deliver the Comet GT to Mara’s Garage.');
    G.time = 60;
  } else if (shot === 'street') {
    // On foot downtown: pedestrians, traffic, the city at its busiest.
    // On the x=0 road facing north, camera behind Jules looking up the street.
    p.pos.set(0, 0, 26);
    p.heading = 0;
    p.mesh.position.copy(p.pos);
    G.camYaw = 0;
    G.camPitch = 0.18;
    G.camDist = 9;
    G.missions.startMission(G, 0);
    G.time = 120;
  } else if (shot === 'mission') {
    // Gunfight at the Docks: pistol out, three enforcers, no wanted level.
    // Close in: twenty metres from the enforcers, facing them.
    p.pos.set(210, 0, 144);
    p.heading = 1.25;
    p.weapon = 'pistol';
    p.mesh.position.copy(p.pos);
    G.camYaw = 1.25 + Math.PI;
    G.camPitch = 0.14;
    G.camDist = 10;
    G.missions.startMission(G, 2);
    // No wanted level for this shot: cruisers would park on Jules and hide
    // the gunfight. The chase shots carry the police; this one is the fight.
    G.wanted.stars = 0;
    G.audio.setSiren(false);
    G.time = 180;
  } else if (shot === 'finale') {
    // The finale at dusk: ramming Kaine's limo, four stars, sun low.
    // Comet GT on the ring road, throttle held, limo 38 m ahead of it.
    G.dusk = true;
    applyDuskLighting(G);
    const comet = G.cars.comet;
    comet.pos.set(-52, 0, -104);
    comet.heading = Math.PI / 2;
    comet.parked = false;
    p.pos.set(-52, 0, -104);
    putPlayerInCar(G, comet, 30);
    G.shotDrive = true;
    G.camPitch = 0.22;
    G.camDist = 12;
    G.missions.startMission(G, 5);
    G.cars.limo.loopS = 90;
    G.wanted.stars = 4;
    G.audio.setSiren(true);
    G.time = 240;
  } else {
    return false;
  }
  // Let the world settle a few frames, then tell the screenshot runner.
  G.shotReadyAfter = G.frame + 40;
  return true;
}

export function applyDuskLighting(G) {
  G.sun.color.setHex(0xffb36b);
  G.sun.intensity = 1.6;
  G.sun.position.set(-180, 90, 260);
  G.scene.background = new THREE.Color(0xe8905a);
  G.scene.fog = new THREE.Fog(0xe8905a, 180, 620);
  G.hemi.intensity = 0.45;
}
