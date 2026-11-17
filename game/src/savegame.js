// Solmar Bay — saving: localStorage, Continue on the title screen, and an
// autosave every 30 seconds of play.

import { CFG } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      money: Math.floor(G.player.money),
      missionIndex: G.mission.index,
      missionCompleted: G.mission.completed,
      health: Math.round(G.player.health),
      wanted: G.wanted.stars,
      pos: { x: G.player.pos.x, z: G.player.pos.z },
      heading: G.player.heading,
      time: Math.floor(G.time),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(G) {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(G, data) {
  G.player.money = data.money || 0;
  G.player.health = data.health || CFG.playerMaxHealth;
  G.player.pos.set(data.pos ? data.pos.x : 0, 0, data.pos ? data.pos.z : 0);
  G.player.heading = data.heading || 0;
  G.player.mesh.position.copy(G.player.pos);
  G.wanted.stars = 0; // a fresh session starts clean, whatever the save held
  G.time = data.time || 0;
  const missionIndex = Math.min(data.missionIndex || 0, 5);
  G.mission.completed = data.missionCompleted || 0;
  return missionIndex;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CFG.saveKey);
  } catch {
    // ignore
  }
}
