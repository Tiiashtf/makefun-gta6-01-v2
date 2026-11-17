// Solmar Bay — the six-mission story: Jules Vane vs Victor Kaine, handed out
// by fixer Mara Solis. Each mission is a stage machine with a waypoint beacon,
// an objective line and a cash reward.

import * as THREE from 'three';
import { CFG, LANDMARKS, MISSIONS } from './config.js';
import { spawnEnforcers, clearEnforcers } from './combat.js';

export function createMissions() {
  return {
    index: 0,
    stage: 'goto', // goto | steal | deliver | fight | survive | ram | done
    active: false,
    completed: 0,
    ramHits: 0,
    ramCooldown: 0,
    waypoint: null, // {x, z} the beacon marks
    fightTotal: 0,
    beacon: null,
    ring: null,
  };
}

export function buildBeacon(scene) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 20, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  scene.add(ring);
  return { beacon, ring };
}

export function setWaypoint(G, x, z) {
  G.mission.waypoint = { x, z };
  if (G.mission.beacon) {
    G.mission.beacon.position.set(x, 30, z);
    G.mission.beacon.visible = true;
    G.mission.ring.position.set(x, 0.06, z);
    G.mission.ring.visible = true;
  }
}

function hideWaypoint(G) {
  G.mission.waypoint = null;
  if (G.mission.beacon) {
    G.mission.beacon.visible = false;
    G.mission.ring.visible = false;
  }
}

export function startMission(G, index) {
  const m = G.mission;
  const def = MISSIONS[index];
  if (!def) return;
  m.index = index;
  m.active = true;
  m.ramHits = 0;
  m.ramCooldown = 0;
  clearEnforcers(G);
  if (G.cars.limo) {
    G.cars.limo.active = false;
    G.cars.limo.mesh.visible = false;
    G.cars.limo.fleeing = false;
  }
  switch (def.kind) {
    case 'goto':
      m.stage = 'goto';
      setWaypoint(G, def.waypoint.x, def.waypoint.z);
      break;
    case 'steal-deliver':
      m.stage = 'steal';
      setWaypoint(G, def.carSpot.x, def.carSpot.z);
      break;
    case 'fight':
      m.stage = 'fight';
      m.fightTotal = def.enforcers;
      setWaypoint(G, def.waypoint.x, def.waypoint.z);
      spawnEnforcers(G, def.waypoint.x, def.waypoint.z, def.enforcers);
      break;
    case 'survive':
      m.stage = 'survive';
      hideWaypoint(G);
      G.wanted.addWanted(G, def.wanted);
      break;
    case 'ram':
      m.stage = 'ram';
      G.cars.limo.active = true;
      G.cars.limo.mesh.visible = true;
      G.cars.limo.loopS = 0;
      setWaypoint(G, 0, -104);
      break;
    default:
      m.stage = 'goto';
  }
  G.hud.showToast(`Mission ${index + 1}/6 — ${def.name}`);
  G.hud.showObjective(def.brief);
}

export function setStage(G, stage) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  m.stage = stage;
  if (stage === 'deliver' && def.kind === 'steal-deliver') {
    setWaypoint(G, def.waypoint.x, def.waypoint.z);
  }
}

export function restartMission(G) {
  const m = G.mission;
  if (!m.active) return;
  // Put Jules back near the mission start, healthy, and re-run the mission.
  const def = MISSIONS[m.index];
  const start = def.waypoint || { x: 0, z: 0 };
  if (G.player.car) {
    G.player.car = null;
    G.player.onFoot = true;
    G.player.mesh.visible = true;
  }
  G.player.pos.set(start.x + 12, 0, start.z + 12);
  G.player.health = CFG.playerMaxHealth;
  if (def.kind === 'survive') G.wanted.stars = 0;
  startMission(G, m.index);
  G.hud.showToast(`Mission restarted: ${def.name}`);
}

function completeMission(G) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  m.active = false;
  m.completed += 1;
  G.player.money += def.reward;
  G.stats.missionsDone += 1;
  G.audio.missionComplete();
  G.hud.showToast(`Mission complete — ${def.name}! +$${def.reward}`);
  G.savegame.save(G);
  hideWaypoint(G);
  clearEnforcers(G);
  if (m.index + 1 < MISSIONS.length) {
    window.setTimeout(() => {
      if (G.state === 'playing') startMission(G, m.index + 1);
    }, 2600);
  } else {
    // The story is over: Kaine is finished, Jules owns the bay.
    window.setTimeout(() => {
      if (G.state === 'playing') G.game.storyComplete(G);
    }, 2600);
  }
}

// A solid ram on the limo: only counts at speed, with a cooldown so one
// long scrape is one hit.
export function onLimoRam(G, car) {
  const m = G.mission;
  if (!m.active || m.stage !== 'ram') return;
  if (m.ramCooldown > 0) return;
  if (Math.abs(car.speed) < 8) return;
  m.ramCooldown = 1.6;
  m.ramHits += 1;
  G.cars.limo.fleeing = true;
  G.audio.crash();
  G.hud.showToast(`Direct hit on Kaine’s limo! ${m.ramHits}/3`);
  G.hud.flashDamage();
  if (m.ramHits >= MISSIONS[m.index].hits) {
    if (G.shot) {
      // Staged screenshot: hold at 3/3 so the finale screen never covers the shot.
      m.ramHits = MISSIONS[m.index].hits;
    } else {
      completeMission(G);
    }
  }
}

function objectiveText(G) {
  const m = G.mission;
  if (!m.active) return { text: 'Free roam — Solmar Bay is yours.', distance: null };
  const def = MISSIONS[m.index];
  let text = def.brief;
  if (m.stage === 'steal') text = 'Steal the Comet GT at the Glass Spire.';
  if (m.stage === 'deliver') text = 'Deliver the Comet GT to Mara’s Garage.';
  if (m.stage === 'fight') {
    const alive = G.enforcers.filter((e) => !e.dead).length;
    text = `${def.brief} — ${alive} enforcer${alive === 1 ? '' : 's'} left.`;
  }
  if (m.stage === 'survive') text = `Lose the heat — ${G.wanted.stars} star${G.wanted.stars === 1 ? '' : 's'} left.`;
  if (m.stage === 'ram') text = `Ram Kaine’s limo! ${m.ramHits}/3 hits.`;
  let distance = null;
  if (m.waypoint) {
    distance = Math.round(Math.hypot(
      G.player.pos.x - m.waypoint.x, G.player.pos.z - m.waypoint.z,
    ));
  } else if (m.stage === 'ram' && G.cars.limo) {
    distance = Math.round(Math.hypot(
      G.player.pos.x - G.cars.limo.pos.x, G.player.pos.z - G.cars.limo.pos.z,
    ));
  }
  return { text, distance };
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.ramCooldown > 0) m.ramCooldown -= dt;
  // Beacon pulse so the waypoint reads from across the city.
  if (m.beacon && m.beacon.visible) {
    const pulse = 0.16 + Math.sin(G.time * 3) * 0.07;
    m.beacon.material.opacity = pulse;
    m.ring.scale.setScalar(1 + Math.sin(G.time * 3) * 0.12);
  }
  if (!m.active) return;
  const def = MISSIONS[m.index];
  const p = G.player;
  switch (m.stage) {
    case 'goto': {
      const d = Math.hypot(p.pos.x - def.waypoint.x, p.pos.z - def.waypoint.z);
      if (d < def.radius) completeMission(G);
      break;
    }
    case 'steal': {
      // Completing the steal is handled by enterCar; nothing to check here.
      break;
    }
    case 'deliver': {
      if (!p.car || !p.car.comet) break;
      const d = Math.hypot(p.pos.x - def.waypoint.x, p.pos.z - def.waypoint.z);
      if (d < def.radius) completeMission(G);
      break;
    }
    case 'fight': {
      const alive = G.enforcers.filter((e) => !e.dead).length;
      if (alive === 0 && G.enforcers.length === 0) completeMission(G);
      break;
    }
    case 'survive': {
      if (G.wanted.stars === 0) completeMission(G);
      break;
    }
    case 'ram': {
      // Completion is handled by onLimoRam.
      break;
    }
    default:
      break;
  }
  G.hud.setObjective(objectiveText(G));
}
