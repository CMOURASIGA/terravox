import obstacles from './forest-obstacles.json';

export function forestHeight(x: number, z: number) {
  const bank = Math.max(0, Math.min(1, (Math.abs(x) - 4) / 6));
  return bank * (1.2 + .8 * Math.sin(.34 * x - .12 * z) + .6 * Math.cos(.31 * z));
}

export function canStand(x: number, z: number) {
  return obstacles.every(([cx, cz, radius]) => Math.hypot(x - cx, z - cz) >= radius + .25);
}
