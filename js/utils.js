export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export const angleLerp = (a, b, t) => a + wrapAngle(b - a) * t;

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothArray(arr, radius, closed = true) {
  const n = arr.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, c = 0;
    for (let o = -radius; o <= radius; o++) {
      let j = i + o;
      if (closed) j = ((j % n) + n) % n;
      else if (j < 0 || j >= n) continue;
      sum += arr[j]; c++;
    }
    out[i] = sum / c;
  }
  return out;
}

export function formatTime(sec) {
  if (sec == null || !isFinite(sec) || sec < 0) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
