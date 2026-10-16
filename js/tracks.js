export function terrainHeight(def, x, z) {
  const t = def.terrain;
  const ph = t.phase || 0;
  return t.amp * (
    0.62 * Math.sin(x / t.scale + ph) * Math.cos(z / t.scale - ph) +
    0.38 * Math.sin((x * 0.85 + z * 1.35) / (t.scale * 0.62) + ph * 1.7)
  );
}

export const TRACKS = [
  {
    id: 'sunset',
    name: 'Sunset Speedway',
    location: 'Riviera Coast',
    radius: 190,
    harmonics: [
      { k: 3, a: 0.14, phase: 0.0 },
      { k: 5, a: 0.06, phase: 1.2 },
    ],
    terrain: { amp: 7, scale: 300, phase: 0.6 },
    roadWidth: 16,
    grip: 21,
    topSpeed: 92,
    theme: {
      skyTop: 0x243a72, skyMid: 0xff9152, skyBottom: 0xffd9a6,
      sunColor: 0xffcf94, sunPos: [-620, 190, -760], sunIntensity: 2.7, sunPower: 220,
      hemiSky: 0xffc79a, hemiGround: 0x6a5636, hemiIntensity: 0.6,
      ambient: 0xffb980, ambientIntensity: 0.35,
      fog: 0xffc088, fogDensity: 0.0011,
      ground: 0x8a6f47, groundAlt: 0x6d5735,
      tree: 0x2c5c38, treeAlt: 0x3d7444,
      rock: 0x9b8d7c,
      barrier: 0xe8e6e2, barrierAccent: 0xc2453b,
      grandstand: 0x2a3550,
      neon: false,
    },
  },
  {
    id: 'alpine',
    name: 'Alpine Grand Prix',
    location: 'North Highlands',
    radius: 232,
    harmonics: [
      { k: 2, a: 0.21, phase: 0.4 },
      { k: 4, a: 0.085, phase: 1.9 },
      { k: 7, a: 0.04, phase: 3.1 },
    ],
    terrain: { amp: 30, scale: 420, phase: 0.2 },
    roadWidth: 15,
    grip: 20,
    topSpeed: 90,
    theme: {
      skyTop: 0x2b6bd4, skyMid: 0x8ec3f2, skyBottom: 0xe3f2ff,
      sunColor: 0xfff5df, sunPos: [760, 820, 420], sunIntensity: 3.1, sunPower: 420,
      hemiSky: 0xd6e9ff, hemiGround: 0x4a5a44, hemiIntensity: 0.75,
      ambient: 0x9fc4ff, ambientIntensity: 0.4,
      fog: 0xcfe4f5, fogDensity: 0.00085,
      ground: 0x4f7a3a, groundAlt: 0x3c6230,
      tree: 0x22502c, treeAlt: 0x2f6b38,
      rock: 0x8f8f93,
      barrier: 0xeceff3, barrierAccent: 0x2f8f4f,
      grandstand: 0x39465f,
      neon: false,
    },
  },
  {
    id: 'neon',
    name: 'Neon Night Circuit',
    location: 'Sector 7 Megacity',
    radius: 200,
    harmonics: [
      { k: 3, a: 0.2, phase: 0.0 },
      { k: 6, a: 0.1, phase: 1.0 },
      { k: 9, a: 0.045, phase: 2.4 },
    ],
    terrain: { amp: 10, scale: 340, phase: 1.1 },
    roadWidth: 16,
    grip: 22,
    topSpeed: 94,
    theme: {
      skyTop: 0x03040c, skyMid: 0x0a1030, skyBottom: 0x1a1e46,
      sunColor: 0x9fb6ff, sunPos: [-360, 460, 540], sunIntensity: 0.75, sunPower: 30,
      hemiSky: 0x22306a, hemiGround: 0x080a14, hemiIntensity: 0.4,
      ambient: 0x2a3a7a, ambientIntensity: 0.35,
      fog: 0x0a0e22, fogDensity: 0.0018,
      ground: 0x14161f, groundAlt: 0x0d0f16,
      tree: 0x1c2a3c, treeAlt: 0x24384e,
      rock: 0x2a2e3a,
      barrier: 0x1a2130, barrierAccent: 0x00e5ff,
      grandstand: 0x11172a,
      neon: true,
    },
  },
];

export const RIDER_NAMES = [
  'V. ROSSI', 'M. MARQUEZ', 'F. QUARTARARO', 'J. MARTIN',
  'P. BAGNAIA', 'B. BINDER', 'A. RINS', 'J. ZARCO',
  'E. BASTIANINI', 'L. MARINI', 'A. ESPARGARO', 'M. BEZZECCHI',
];

export const RIDER_COLORS = [
  0xff2e63, 0x16f2d0, 0xffb020, 0x7c4dff,
  0x00c2ff, 0xff6d3c, 0x51d66b, 0xe0e6f0,
];
