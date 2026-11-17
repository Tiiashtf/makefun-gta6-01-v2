// Solmar Bay — shared tuning, names and story data for the open-world game.
// Every number the systems agree on lives here so a tweak lands everywhere.

export const CFG = {
  seed: 20261117,
  blocksPerSide: 8,
  blockSize: 40,
  roadWidth: 12,
  pitch: 52, // blockSize + roadWidth
  cityHalf: 214, // roads run from -208 to +208, road half-width 6
  beachStartZ: 228, // sand strip begins here
  seaStartZ: 282, // water begins here
  walkSpeed: 6.2,
  runSpeed: 10.5,
  carTopSpeed: 46,
  trafficCount: 16,
  pedestrianCount: 26,
  maxWanted: 5,
  heatDecaySeconds: 12, // one star fades after this long out of sight
  bustSeconds: 2.5, // police hold on foot this long to bust Jules
  sprayCost: 150,
  bustFine: 100,
  wastedFine: 100,
  playerMaxHealth: 100,
  pistolDamage: 34,
  punchDamage: 30,
  enforcerHealth: 100,
  enforcerShotDamage: 8,
  saveKey: 'solmar-bay-save-v1',
  autosaveSeconds: 30,
};

// Road centre lines, west to east and north to south.
export const ROAD_LINES = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

// Block centres: -182, -130, -78, -26, 26, 78, 130, 182.
export function blockCentre(i) {
  return -182 + i * CFG.pitch;
}

// Named places of Solmar Bay. Positions are world coordinates (x east, z south).
export const LANDMARKS = {
  sunPlaza: { x: -182, z: -182, label: 'SUN PLAZA' },
  glassSpire: { x: -130, z: -130, label: 'GLASS SPIRE' },
  marasGarage: { x: 26, z: 130, label: "MARA'S GARAGE" },
  kaineWarehouse: { x: 130, z: -78, label: 'KAINE WAREHOUSE' },
  docks: { x: 228, z: 150, label: 'THE DOCKS' },
  harborCafe: { x: 78, z: 182, label: 'HARBOR CAFE' },
  paintSpray: { x: -130, z: 78, label: "LOU'S PAINT & SPRAY" },
  solmarGeneral: { x: 78, z: -26, label: 'SOLMAR GENERAL' },
  pier: { x: 26, z: 300, label: 'SOLMAR PIER' },
  lighthouse: { x: 26, z: 356, label: 'LIGHTHOUSE' },
};

// The six-mission story: Jules Vane comes home broke; fixer Mara Solis hands out
// the jobs; developer kingpin Victor Kaine owns the other side of the bay.
export const MISSIONS = [
  {
    id: 'welcome-home',
    name: 'Welcome Home',
    brief: 'Mara is waiting at Sun Plaza. Get there — on foot or in a car.',
    reward: 200,
    kind: 'goto',
    waypoint: { x: -182, z: -182 },
    radius: 9,
    hint: 'Follow the yellow beacon. WASD to move, drag the mouse to look.',
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    brief: 'Steal the Comet GT from the Glass Spire and deliver it to Mara’s Garage.',
    reward: 400,
    kind: 'steal-deliver',
    carSpot: { x: -104, z: -130 },
    // Delivery point is the garage forecourt, not the building centre: the
    // garage itself pushes a car to 15 m, outside a 10 m radius around its
    // middle, so a waypoint inside the building could never be reached.
    waypoint: { x: 26, z: 112 },
    radius: 10,
    hint: 'Press E near the Comet GT to take it. The law notices a stolen car.',
  },
  {
    id: 'the-pickup',
    name: 'The Pickup',
    brief: 'Kaine’s enforcers are holding the Docks. Clear them out — pistol beats fists.',
    reward: 600,
    kind: 'fight',
    waypoint: { x: 228, z: 150 },
    radius: 26,
    enforcers: 3,
    hint: 'Click to shoot, Q to swap fists and pistol. Enforcers are the ones in red.',
  },
  {
    id: 'getaway',
    name: 'Getaway',
    brief: 'Three stars and every cruiser in the bay on your tail. Lose the heat.',
    reward: 800,
    kind: 'survive',
    wanted: 3,
    hint: 'Outrun them until the stars fade, or pay $150 at Lou’s Paint & Spray.',
  },
  {
    id: 'payback',
    name: 'Payback',
    brief: 'Hit Kaine where it hurts: clear his crew out of the Kaine Warehouse.',
    reward: 1200,
    kind: 'fight',
    waypoint: { x: 130, z: -78 },
    radius: 26,
    enforcers: 4,
    hint: 'Four enforcers guard the warehouse. Use cover, pick them off one by one.',
  },
  {
    id: 'king-of-the-bay',
    name: 'King of the Bay',
    brief: 'Kaine’s limo is circling the bay. Ram it three times and end this.',
    reward: 1500,
    kind: 'ram',
    hits: 3,
    hint: 'Ram the black limo at speed. Three solid hits and Kaine is done.',
  },
];

export const STORY_INTRO =
  'Jules Vane came home to Solmar Bay broke, with a dead phone and a borrowed jacket. ' +
  'Mara Solis — fixer, friend, the only person in the bay who still answers Jules’s calls — ' +
  'has work. Victor Kaine owns the docks, the warehouses and half the cops. Six jobs stand ' +
  'between Jules and the whole bay.';

// Car models the bay drives: all original names, all built from boxes.
export const CAR_MODELS = [
  { name: 'Comet GT', color: 0xd7263d, top: 52, accel: 26, grip: 2.6, length: 4.4, sport: true },
  { name: 'Bayliner', color: 0x2e86de, top: 40, accel: 18, grip: 2.2, length: 4.2 },
  { name: 'Solmar Cab', color: 0xf5b301, top: 38, accel: 17, grip: 2.1, length: 4.3 },
  { name: 'Harbor Van', color: 0x7f8c8d, top: 34, accel: 14, grip: 1.9, length: 4.8 },
  { name: 'Palm Coupe', color: 0x27ae60, top: 44, accel: 20, grip: 2.3, length: 4.1 },
  { name: 'Dune Buggy', color: 0xe67e22, top: 42, accel: 21, grip: 2.4, length: 3.9 },
];

// Palette: a sun-soaked coastal city at late morning.
export const PALETTE = {
  skyDay: 0x87bfe8,
  skyDusk: 0xe8905a,
  sunDay: 0xfff2d8,
  sunDusk: 0xffb36b,
  ground: 0x9aa578,
  sand: 0xe8d29a,
  sea: 0x1e7fa8,
  road: 0x3a3f46,
  sidewalk: 0xb9b3a4,
  plaza: 0xd8cfb8,
};
