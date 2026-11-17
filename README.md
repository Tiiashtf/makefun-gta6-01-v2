# Solmar Bay — Make GTA 6

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Tiiashtf/makefun-gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Tiiashtf/makefun-gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is a complete, original 3D open-world crime game in the spirit of GTA 6 — built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). It runs offline in a desktop browser from static files, with no network request and no build step: open `game/index.html` (or `node serve.ts` and visit http://localhost:8080).

## The game

Jules Vane comes home to Solmar Bay broke, with a dead phone and a borrowed jacket. Fixer Mara Solis has work. Developer kingpin Victor Kaine owns the docks, the warehouses and half the cops. Six jobs stand between Jules and the whole bay:

1. **Welcome Home** — reach Mara at Sun Plaza.
2. **Hot Wheels** — steal the Comet GT and deliver it to Mara's Garage.
3. **The Pickup** — clear Kaine's enforcers off the Docks.
4. **Getaway** — lose a 3-star wanted level.
5. **Payback** — clear the Kaine Warehouse.
6. **King of the Bay** — ram Kaine's limo three times.

## What's in the world

- **A city to explore** — an 8×8-block procedural coastal grid: ~120 buildings, Sun Plaza, the Glass Spire, the Docks, the pier and lighthouse, marina boats, palms, streetlights, beach and sea.
- **On foot and by car** — third-person walking and running, arcade driving with handbrake slides, building and car collisions.
- **Traffic and pedestrians** — 16 cars following the road grid and turning at intersections, 26 locals strolling the sidewalks who scatter from speeding cars and gunfire.
- **Cars to steal** — parked cars all over the bay, including the Comet GT. Theft draws the law.
- **Wanted level and police** — 0–5 stars, cruisers that chase and ram, being busted on foot, heat that fades when the law loses sight of you, and Lou's Paint & Spray ($150) to buy the heat off.
- **Combat** — fists and pistol, enforcer AI that chases and shoots, tracers, muzzle flash and hitmarkers.
- **HUD with live minimap** — health, money, weapon, wanted stars, clock, speedometer, crosshair, objective with distance, and a 220px minimap showing roads, traffic, police, enforcers and the mission waypoint.
- **Menus and save** — title screen with New Game / Continue, pause, wasted, busted and story-complete screens, localStorage save with autosave every 30 seconds.
- **Sound** — fully synthesised WebAudio: engine hum, sirens, gunshots, a bass music loop and mission jingles. No audio files. Press M to mute.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse drag | Look around |
| Mouse wheel | Zoom camera |
| E | Enter / exit car |
| Click | Punch / shoot |
| Q | Swap fists / pistol |
| Shift | Run |
| Space | Handbrake |
| R | Restart mission |
| Esc | Pause |
| M | Mute |

## Structure

The game's own source lives in `game/src/`, one file per job:

- `config.js` — tuning, city layout, story and mission data
- `random.js` — seeded randomness (deterministic city)
- `city.js` — builds the city, beach, pier, landmarks and collisions
- `player.js` — Jules on foot and the orbit / chase camera
- `vehicles.js` — car meshes, traffic AI, parked cars, Kaine's limo
- `driving.js` — arcade driving, collisions, entering and exiting cars
- `pedestrians.js` — locals who stroll and scatter
- `wanted.js` — stars, police chases, busts, heat decay, Paint & Spray
- `combat.js` — fists, pistol, enforcer AI, tracers
- `missions.js` — the six-mission story and the waypoint beacon
- `hud.js` — HUD, minimap, toasts and menus
- `audio.js` — synthesised WebAudio sound
- `savegame.js` — localStorage save / continue / autosave
- `shots.js` — deterministic screenshot staging (`?shot=cover|street|mission|finale`)
- `main.js` — renderer, input, game loop and state machine

three.js is vendored under `game/vendor/` as `three.module.min.js`. Everything in Solmar Bay — the city, characters, vehicles, names, story, art and sounds — is original. Nothing comes from Rockstar Games or any other commercial game.

## Screenshots

`1-cover.jpg` (getaway, three stars), `2-street.jpg` (on foot downtown), `3-mission.jpg` (gunfight at the Docks), `4-finale.jpg` (ramming the limo at dusk) — real renders of the game in headless Chromium, staged with `?shot=...` so they are reproducible.

## License

MIT — see [LICENSE](LICENSE).
