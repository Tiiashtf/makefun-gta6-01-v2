// Solmar Bay — the HUD: health, money, weapon, wanted stars, clock,
// speedometer, crosshair, a live minimap, objective line, toasts, and the
// title / pause / wasted / busted / story-complete screens.

import { CFG, MISSIONS, STORY_INTRO } from './config.js';

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function createHud(G) {
  const root = document.getElementById('hud');
  const hud = {
    root,
    minimap: null,
    minimapCtx: null,
    money: null,
    healthBar: null,
    healthText: null,
    weapon: null,
    stars: null,
    clock: null,
    speed: null,
    objective: null,
    objectiveDist: null,
    prompt: null,
    toast: null,
    toastTimer: null,
    hitmarker: null,
    damageFlash: null,
    overlays: {},
    minimapSize: 220,
  };

  // Top-left: money, health, weapon.
  const stats = el('div', 'hud-stats', root);
  hud.money = el('div', 'hud-money', stats, '$0');
  const healthWrap = el('div', 'hud-health', stats);
  hud.healthBar = el('div', 'hud-health-bar', healthWrap);
  hud.healthText = el('div', 'hud-health-text', healthWrap, '100');
  hud.weapon = el('div', 'hud-weapon', stats, '✊ FISTS');

  // Top-right: wanted stars and the clock.
  const right = el('div', 'hud-right', root);
  hud.stars = el('div', 'hud-stars', right, '☆☆☆☆☆');
  hud.clock = el('div', 'hud-clock', right, '10:00');

  // Top-centre: the current objective and its distance.
  const obj = el('div', 'hud-objective', root);
  hud.objective = el('span', 'hud-objective-text', obj, '');
  hud.objectiveDist = el('span', 'hud-objective-dist', obj, '');

  // Bottom-left: live minimap.
  const mapWrap = el('div', 'hud-map', root);
  const mapTitle = el('div', 'hud-map-title', mapWrap, 'SOLMAR BAY');
  void mapTitle;
  hud.minimap = el('canvas', 'hud-minimap', mapWrap);
  hud.minimap.width = hud.minimapSize;
  hud.minimap.height = hud.minimapSize;
  hud.minimapCtx = hud.minimap.getContext('2d');

  // Bottom-right: speedometer, shown while driving.
  hud.speed = el('div', 'hud-speed', root, '0 mph');
  hud.speed.style.display = 'none';

  // Centre: crosshair and hitmarker.
  hud.crosshair = el('div', 'hud-crosshair', root, '+');
  hud.hitmarker = el('div', 'hud-hitmarker', root, '✕');
  hud.hitmarker.style.opacity = '0';

  // Interaction prompt above the bottom edge.
  hud.prompt = el('div', 'hud-prompt', root, '');

  // Toast line under the objective.
  hud.toast = el('div', 'hud-toast', root, '');
  hud.toast.style.opacity = '0';

  // Full-screen red flash when Jules takes a hit.
  hud.damageFlash = el('div', 'hud-damage', root);

  buildOverlays(G, hud);
  // Bind the helpers other systems call as methods on the hud object.
  hud.showToast = (text) => showToast(hud, text);
  hud.showObjective = (text) => setObjective(hud, { text, distance: null });
  hud.setObjective = (obj) => setObjective(hud, obj);
  hud.showHitmarker = () => showHitmarker(hud);
  hud.flashDamage = () => flashDamage(hud);
  hud.showOverlay = (name) => showOverlay(hud, name);
  return hud;
}

function buildOverlays(G, hud) {
  const overlayRoot = document.getElementById('overlays');

  // Title screen.
  const title = el('div', 'overlay overlay-title', overlayRoot);
  el('h1', 'game-title', title, 'SOLMAR BAY');
  el('p', 'game-sub', title, 'An open-world crime story — in the spirit of GTA 6');
  el('p', 'game-story', title, STORY_INTRO);
  const btnRow = el('div', 'btn-row', title);
  const newBtn = el('button', 'btn btn-primary', btnRow, '▶  NEW GAME');
  newBtn.addEventListener('click', () => G.game.newGame(G));
  const contBtn = el('button', 'btn', btnRow, '↻  CONTINUE');
  contBtn.addEventListener('click', () => G.game.continueGame(G));
  const hasSave = !!window.localStorage.getItem(CFG.saveKey);
  contBtn.disabled = !hasSave;
  const controls = el('div', 'game-controls', title);
  controls.innerHTML =
    '<b>WASD</b> move / drive &nbsp; <b>Mouse drag</b> look &nbsp; <b>Wheel</b> zoom<br>' +
    '<b>E</b> enter / exit car &nbsp; <b>Click</b> punch / shoot &nbsp; <b>Q</b> fists / pistol<br>' +
    '<b>Shift</b> run &nbsp; <b>Space</b> handbrake &nbsp; <b>R</b> restart mission<br>' +
    '<b>Esc</b> pause &nbsp; <b>M</b> mute';
  el('p', 'game-credit', title, 'A fully original game. Solmar Bay, Jules Vane, Mara Solis and Victor Kaine are inventions — no Rockstar names, art or music.');
  hud.overlays.title = title;

  // Pause screen.
  const pause = el('div', 'overlay', overlayRoot);
  el('h1', '', pause, 'PAUSED');
  el('p', '', pause, 'Solmar Bay waits for no one. Well — except now.');
  const pauseRow = el('div', 'btn-row', pause);
  const resumeBtn = el('button', 'btn btn-primary', pauseRow, '▶  RESUME');
  resumeBtn.addEventListener('click', () => G.game.resume(G));
  const quitBtn = el('button', 'btn', pauseRow, 'SAVE & TITLE');
  quitBtn.addEventListener('click', () => G.game.toTitle(G));
  hud.overlays.pause = pause;

  // Wasted screen.
  const wasted = el('div', 'overlay overlay-wasted', overlayRoot);
  el('h1', '', wasted, 'WASTED');
  el('p', '', wasted, 'Jules went down. The bay keeps moving — so do you.');
  const wastedRow = el('div', 'btn-row', wasted);
  const retryBtn = el('button', 'btn btn-primary', wastedRow, '↻  GET UP ($100)');
  retryBtn.addEventListener('click', () => G.game.respawn(G));
  hud.overlays.wasted = wasted;

  // Busted screen.
  const busted = el('div', 'overlay overlay-busted', overlayRoot);
  el('h1', '', busted, 'BUSTED');
  el('p', '', busted, 'The Solmar Bay PD took Jules in. Bail: $100. The heat is off.');
  const bustedRow = el('div', 'btn-row', busted);
  const bailBtn = el('button', 'btn btn-primary', bustedRow, '↻  POST BAIL ($100)');
  bailBtn.addEventListener('click', () => G.game.respawn(G));
  hud.overlays.busted = busted;

  // Story-complete screen.
  const complete = el('div', 'overlay overlay-complete', overlayRoot);
  el('h1', '', complete, 'KING OF THE BAY');
  el('p', '', complete, 'Kaine’s limo is scrap, his crew is scattered, and Mara is already counting the money. Solmar Bay belongs to Jules Vane now.');
  const compRow = el('div', 'btn-row', complete);
  const roamBtn = el('button', 'btn btn-primary', compRow, '▶  KEEP ROAMING');
  roamBtn.addEventListener('click', () => G.game.resume(G));
  const compTitleBtn = el('button', 'btn', compRow, 'TITLE SCREEN');
  compTitleBtn.addEventListener('click', () => G.game.toTitle(G));
  hud.overlays.complete = complete;

  for (const key of Object.keys(hud.overlays)) {
    hud.overlays[key].style.display = 'none';
  }
  hud.overlays.title.style.display = 'flex';
}

export function showOverlay(hud, name) {
  for (const key of Object.keys(hud.overlays)) {
    hud.overlays[key].style.display = key === name ? 'flex' : 'none';
  }
  hud.root.style.display = name ? 'none' : 'block';
}

function drawMinimap(G) {
  const hud = G.hud;
  const ctx = hud.minimapCtx;
  const size = hud.minimapSize;
  const scale = size / 560; // world -280..280 maps to the canvas
  const toMap = (x, z) => [(x + 280) * scale, (z + 280) * scale];
  ctx.clearRect(0, 0, size, size);
  // Sea and beach along the bottom (south) edge.
  ctx.fillStyle = '#0e2a3a';
  ctx.fillRect(0, 0, size, size);
  const [, beachY] = toMap(0, 228);
  const [, seaY] = toMap(0, 282);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, beachY, size, seaY - beachY);
  ctx.fillStyle = '#1e7fa8';
  ctx.fillRect(0, seaY, size, size - seaY);
  // City blocks.
  ctx.fillStyle = '#20262e';
  ctx.fillRect(0, 0, size, beachY);
  // Roads.
  ctx.strokeStyle = '#5a636e';
  ctx.lineWidth = 4;
  for (const line of [-208, -156, -104, -52, 0, 52, 104, 156, 208]) {
    const [rx] = toMap(line, 0);
    const [, rz] = toMap(0, line);
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, beachY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, rz);
    ctx.lineTo(size, rz);
    ctx.stroke();
  }
  // Sun Plaza.
  ctx.fillStyle = '#d8cfb8';
  const [px, pz] = toMap(-182, -182);
  ctx.beginPath();
  ctx.arc(px, pz, 5, 0, Math.PI * 2);
  ctx.fill();
  // Traffic dots.
  ctx.fillStyle = '#ffffff';
  for (const car of G.cars.traffic) {
    const [cx, cz] = toMap(car.pos.x, car.pos.z);
    ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
  }
  // Police dots.
  ctx.fillStyle = '#ff3344';
  for (const car of G.cars.police) {
    const [cx, cz] = toMap(car.pos.x, car.pos.z);
    ctx.beginPath();
    ctx.arc(cx, cz, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Enforcers.
  ctx.fillStyle = '#ff8800';
  for (const e of G.enforcers) {
    if (e.dead) continue;
    const [ex, ez] = toMap(e.pos.x, e.pos.z);
    ctx.fillRect(ex - 2, ez - 2, 4, 4);
  }
  // Mission waypoint blip, pulsing.
  if (G.mission.waypoint) {
    const [wx, wz] = toMap(G.mission.waypoint.x, G.mission.waypoint.z);
    const pulse = 5 + Math.sin(G.time * 4) * 2;
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(wx, wz, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20262e';
    ctx.beginPath();
    ctx.arc(wx, wz, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The limo, when it is the target.
  if (G.cars.limo && G.cars.limo.active) {
    const [lx, lz] = toMap(G.cars.limo.pos.x, G.cars.limo.pos.z);
    ctx.fillStyle = '#c77dff';
    ctx.beginPath();
    ctx.arc(lx, lz, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Jules: a white arrow pointing where he faces. Fall back to his on-foot
  // heading if he is somehow between cars, so the minimap never throws.
  const [jx, jz] = toMap(G.player.pos.x, G.player.pos.z);
  const facing = G.player.onFoot || !G.player.car ? G.player.heading : G.player.car.heading;
  ctx.save();
  ctx.translate(jx, jz);
  ctx.rotate(-facing);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#20262e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function updateHud(G) {
  const hud = G.hud;
  const p = G.player;
  hud.money.textContent = `$${Math.floor(p.money).toLocaleString('en-US')}`;
  const hp = Math.max(0, Math.round(p.health));
  hud.healthBar.style.width = `${hp}%`;
  hud.healthBar.style.background = hp > 50 ? '#37d67a' : hp > 25 ? '#f5b301' : '#e74c3c';
  hud.healthText.textContent = `${hp}`;
  hud.weapon.textContent = p.weapon === 'pistol' ? '🔫 PISTOL' : '✊ FISTS';
  const stars = '★'.repeat(G.wanted.stars) + '☆'.repeat(CFG.maxWanted - G.wanted.stars);
  hud.stars.textContent = stars;
  hud.stars.style.color = G.wanted.stars > 0 ? '#ffd23c' : 'rgba(255,255,255,0.55)';
  // In-game clock: one game hour every two real minutes, starting 10:00.
  const totalMinutes = 600 + Math.floor(G.time * 0.5);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  hud.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (p.car) {
    hud.speed.style.display = 'block';
    hud.speed.textContent = `${Math.round(Math.abs(p.car.speed) * 2.2)} mph`;
  } else {
    hud.speed.style.display = 'none';
  }
  hud.crosshair.style.opacity = p.weapon === 'pistol' && p.onFoot ? '1' : '0.25';
  // Interaction prompt.
  let prompt = '';
  if (p.onFoot) {
    const near = G.driving.nearestCar(G, 4);
    if (near) prompt = near.comet ? '[E] Steal the Comet GT' : `[E] Take the ${near.name}`;
    if (G.wanted.stars > 0 && G.wanted.sprayActive) prompt = 'Repainting… $150';
  } else if (G.wanted.stars > 0) {
    const spray = { x: -130, z: 78 };
    const inZone = Math.hypot(p.pos.x - spray.x, p.pos.z - spray.z) < 18;
    if (inZone) prompt = p.money >= CFG.sprayCost ? 'Paint & Spray — $150 (drive in)' : 'Paint & Spray — need $150';
  }
  hud.prompt.textContent = prompt;
  hud.prompt.style.opacity = prompt ? '1' : '0';
  drawMinimap(G);
}

export function setObjective(hud, obj) {
  hud.objective.textContent = obj.text;
  hud.objectiveDist.textContent = obj.distance === null || obj.distance === undefined ? '' : `${obj.distance} m`;
}

export function showToast(hud, text) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  if (hud.toastTimer) window.clearTimeout(hud.toastTimer);
  hud.toastTimer = window.setTimeout(() => {
    hud.toast.style.opacity = '0';
  }, 4200);
}

export function showHitmarker(hud) {
  hud.hitmarker.style.opacity = '1';
  window.setTimeout(() => {
    hud.hitmarker.style.opacity = '0';
  }, 140);
}

export function flashDamage(hud) {
  hud.damageFlash.style.opacity = '0.35';
  window.setTimeout(() => {
    hud.damageFlash.style.opacity = '0';
  }, 130);
}
