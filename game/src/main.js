// Solmar Bay — main: renderer, lights, input, the game loop and the state
// machine (title / playing / paused / wasted / busted / complete), plus the
// debug handle the playtests drive (window.__solmar).

import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { makeRng } from './random.js';
import { SoundBank } from './audio.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayerOnFoot, updateCamera } from './player.js';
import { createTraffic, createParkedCars, createLimo, updateTraffic, updateLimo } from './vehicles.js';
import { enterCar, exitCar, updateDriving, nearestCar } from './driving.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createWanted, addWanted, updateWanted } from './wanted.js';
import { spawnEnforcers, updateEnforcers, updateTracers, playerPunch, playerShoot, damagePlayer } from './combat.js';
import {
  createMissions, buildBeacon, startMission, setStage, setWaypoint,
  restartMission, onLimoRam, updateMissions,
} from './missions.js';
import { createHud, updateHud } from './hud.js';
import { saveGame, loadGame, applySave, clearSave } from './savegame.js';
import { parseShotParams, applyShotStaging } from './shots.js';

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(`unhandled: ${String(event.reason)}`);
});

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyDay);
scene.fog = new THREE.Fog(PALETTE.skyDay, 220, 700);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 12, 20);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sunDay, 1.8);
sun.position.set(120, 180, 60);
scene.add(sun);

const G = {
  scene,
  camera,
  renderer,
  sun,
  hemi,
  time: 0,
  animTime: 0,
  frame: 0,
  state: 'title',
  keys: {},
  camYaw: 0,
  camPitch: 0.18,
  camDist: 10,
  dusk: false,
  shot: null,
  shotReadyAfter: Infinity,
  trafficRng: makeRng(CFG.seed + 91),
  pedRng: makeRng(CFG.seed + 93),
  audio: new SoundBank(),
  stats: { shotsFired: 0, shotsHit: 0, carsStolen: 0, missionsDone: 0 },
  tracers: [],
  enforcers: [],
  pedestrians: [],
  autosaveTimer: 0,
};

// World systems.
G.city = buildCity(scene);
G.player = createPlayer(scene);
G.player.pos.set(-170, 0, -158);
G.player.mesh.position.copy(G.player.pos);
G.cars = {
  traffic: createTraffic(G),
  parked: createParkedCars(G),
  police: [],
  limo: createLimo(G),
  comet: null,
  all: [],
};
G.cars.all = [...G.cars.traffic, ...G.cars.parked, G.cars.limo];
G.cars.comet = G.cars.parked.find((c) => c.comet) || null;
G.pedestrians = createPedestrians(G);
G.wanted = createWanted();
G.wanted.addWanted = (g, n) => addWanted(g, n);
G.mission = createMissions();
const beaconParts = buildBeacon(scene);
G.mission.beacon = beaconParts.beacon;
G.mission.ring = beaconParts.ring;
G.driving = { enterCar, exitCar, updateDriving, nearestCar };
G.missions = { startMission, setStage, setWaypoint, restartMission, onLimoRam, updateMissions };
G.savegame = { save: saveGame, load: loadGame, apply: applySave, clear: clearSave };
G.wantedModule = { addWanted, updateWanted };

// --- Game flow: new game, continue, pause, wasted, busted, complete. --------
function hideOverlays() {
  G.hud.showOverlay(null);
}

function beginPlaying() {
  G.state = 'playing';
  hideOverlays();
  G.audio.ensure();
}

G.game = {
  newGame(g) {
    clearSave();
    g.player.money = 0;
    g.player.health = CFG.playerMaxHealth;
    g.player.weapon = 'fists';
    g.player.pos.set(-170, 0, -158);
    g.player.heading = 0;
    g.player.mesh.position.copy(g.player.pos);
    g.wanted.stars = 0;
    g.mission.completed = 0;
    g.time = 0;
    beginPlaying();
    startMission(g, 0);
    g.hud.showToast('Welcome to Solmar Bay, Jules.');
  },
  continueGame(g) {
    const data = loadGame(g);
    if (!data) {
      g.game.newGame(g);
      return;
    }
    const missionIndex = applySave(g, data);
    beginPlaying();
    startMission(g, missionIndex);
    g.hud.showToast('Welcome back to Solmar Bay.');
  },
  resume(g) {
    if (g.state === 'complete') {
      // Keep roaming after the story ends: no active mission.
      g.mission.active = false;
    }
    beginPlaying();
  },
  pause(g) {
    if (g.state !== 'playing') return;
    g.state = 'paused';
    g.hud.showOverlay('pause');
    g.savegame.save(g);
  },
  toTitle(g) {
    g.savegame.save(g);
    g.state = 'title';
    g.hud.showOverlay('title');
    const btns = document.querySelectorAll('.overlay-title button');
    if (btns[1]) btns[1].disabled = !window.localStorage.getItem(CFG.saveKey);
  },
  wasted(g) {
    if (g.state !== 'playing') return;
    g.state = 'wasted';
    g.audio.wasted();
    g.audio.setSiren(false);
    g.hud.showOverlay('wasted');
  },
  busted(g) {
    if (g.state !== 'playing') return;
    g.state = 'busted';
    g.audio.busted();
    g.audio.setSiren(false);
    g.hud.showOverlay('busted');
  },
  respawn(g) {
    g.player.money = Math.max(0, g.player.money - CFG.wastedFine);
    g.player.health = CFG.playerMaxHealth;
    g.wanted.stars = 0;
    g.wanted.bustTimer = 0;
    if (g.player.car) {
      g.player.car = null;
      g.player.onFoot = true;
      g.player.mesh.visible = true;
    }
    // Solmar General patches Jules up and sends him back out.
    g.player.pos.set(78, 0, -8);
    g.player.heading = Math.PI;
    g.player.mesh.position.copy(g.player.pos);
    g.camYaw = Math.PI;
    beginPlaying();
    g.hud.showToast('Patched up at Solmar General. $100 lighter.');
  },
  storyComplete(g) {
    if (g.state !== 'playing') return;
    g.state = 'complete';
    g.audio.missionComplete();
    g.savegame.save(g);
    g.hud.showOverlay('complete');
  },
};

G.hud = createHud(G);

// --- Input: keyboard, mouse drag look, wheel zoom, click to fight. ----------
const mouse = { down: false, moved: 0, downAt: 0, lastX: 0, lastY: 0 };

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  G.keys[event.code] = true;
  G.audio.ensure();
  if (event.code === 'Escape') {
    if (G.state === 'playing') G.game.pause(G);
    else if (G.state === 'paused') G.game.resume(G);
    return;
  }
  if (G.state !== 'playing') return;
  if (event.code === 'KeyE') {
    if (G.player.onFoot) {
      const near = nearestCar(G, 4);
      if (near) enterCar(G, near);
    } else {
      exitCar(G);
    }
  } else if (event.code === 'KeyQ') {
    G.player.weapon = G.player.weapon === 'pistol' ? 'fists' : 'pistol';
    G.audio.click();
  } else if (event.code === 'KeyR') {
    restartMission(G);
  } else if (event.code === 'KeyM') {
    G.audio.setMuted(!G.audio.muted);
    G.hud.showToast(G.audio.muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }
});

window.addEventListener('keyup', (event) => {
  G.keys[event.code] = false;
});

canvas.addEventListener('mousedown', (event) => {
  mouse.down = true;
  mouse.moved = 0;
  mouse.downAt = performance.now();
  mouse.lastX = event.clientX;
  mouse.lastY = event.clientY;
  G.audio.ensure();
});
window.addEventListener('mousemove', (event) => {
  if (!mouse.down) return;
  const dx = event.clientX - mouse.lastX;
  const dy = event.clientY - mouse.lastY;
  mouse.lastX = event.clientX;
  mouse.lastY = event.clientY;
  mouse.moved += Math.abs(dx) + Math.abs(dy);
  G.camYaw -= dx * 0.005;
  G.camPitch = Math.max(-0.1, Math.min(0.9, G.camPitch + dy * 0.004));
});
window.addEventListener('mouseup', (event) => {
  if (!mouse.down) return;
  mouse.down = false;
  if (G.state !== 'playing') return;
  const quick = performance.now() - mouse.downAt < 350;
  if (quick && mouse.moved < 8 && event.target === canvas) {
    if (G.player.onFoot) {
      if (G.player.weapon === 'pistol') playerShoot(G);
      else playerPunch(G);
    }
  }
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  G.camDist = Math.max(4, Math.min(18, G.camDist + event.deltaY * 0.01));
}, { passive: false });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- The loop ----------------------------------------------------------------
const clock = new THREE.Clock();

function step(dt) {
  G.animTime += dt;
  if (G.state === 'title') {
    // Slow orbit over Sun Plaza behind the title screen.
    G.camYaw += dt * 0.05;
    camera.position.set(
      -182 + Math.sin(G.camYaw) * 26,
      14,
      -182 + Math.cos(G.camYaw) * 26,
    );
    camera.lookAt(-182, 4, -182);
    G.city.updateCity(dt, G.animTime);
    return;
  }
  if (G.state !== 'playing') return;

  G.time += dt;
  const p = G.player;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;

  // Screenshot staging: hold the throttle so staged getaway cars keep moving.
  if (G.shotDrive && p.car) G.keys.KeyW = true;

  if (p.onFoot) updatePlayerOnFoot(G, dt);
  else updateDriving(G, dt);

  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateEnforcers(G, dt);
  updateTracers(G, dt);
  updateWanted(G, dt);
  updateMissions(G, dt);
  updateLimo(G, dt);
  G.city.updateCity(dt, G.animTime);

  // Slow health regen after five quiet seconds.
  if (p.health > 0 && p.health < CFG.playerMaxHealth && G.time - p.lastDamageAt > 5) {
    p.health = Math.min(CFG.playerMaxHealth, p.health + 3 * dt);
  }

  updateCamera(G, dt);
  updateHud(G);

  // Engine sound follows the car; silence on foot.
  if (!p.car) G.audio.setEngine(0, false);

  // Autosave.
  G.autosaveTimer += dt;
  if (G.autosaveTimer > CFG.autosaveSeconds) {
    G.autosaveTimer = 0;
    saveGame(G);
  }
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1);
  step(dt);
  renderer.render(scene, camera);
  G.frame += 1;
  if (G.frame === 1) {
    window.__solmarReady = true;
  }
  if (G.shot && G.frame >= G.shotReadyAfter && !window.__shotReady) {
    window.__shotReady = true;
  }
}

// --- Debug handle for playtests (not part of the game UI). -------------------
window.__solmar = {
  G,
  version: 'solmar-bay-2',
  get state() {
    return G.state;
  },
  get errors() {
    return window.__errors;
  },
  teleport(x, z) {
    G.player.pos.set(x, 0, z);
    G.player.mesh.position.copy(G.player.pos);
    if (G.player.car) {
      G.player.car.pos.set(x, 0, z);
    }
  },
  setMission(index) {
    startMission(G, index);
  },
  setWanted(n) {
    G.wanted.stars = n;
  },
  damagePlayer(amount) {
    damagePlayer(G, amount);
  },
  newGame() {
    G.game.newGame(G);
  },
  summary() {
    return {
      state: G.state,
      mission: G.mission.index,
      missionStage: G.mission.stage,
      money: Math.floor(G.player.money),
      health: Math.round(G.player.health),
      wanted: G.wanted.stars,
      onFoot: G.player.onFoot,
      car: G.player.car ? G.player.car.name : null,
      speed: G.player.car ? Math.round(G.player.car.speed) : 0,
      pos: [Math.round(G.player.pos.x), Math.round(G.player.pos.z)],
      enforcersAlive: G.enforcers.filter((e) => !e.dead).length,
      police: G.cars.police.length,
      traffic: G.cars.traffic.length,
      pedestrians: G.pedestrians.length,
      stats: { ...G.stats },
      frame: G.frame,
      time: Math.round(G.time),
    };
  },
};

// Shot staging (deterministic screenshots) or the title screen.
const shotParams = parseShotParams();
G.shot = shotParams.shot;
if (G.shot) {
  // Start in the world, then stage the shot once the first frames render.
  applyShotStaging(G, G.shot);
}
loop();
