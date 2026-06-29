import {each} from 'lodash';

// Deterministic RNG support (E2E only). When a seed is set, all shuffle-based
// randomness — the deck deal/reshuffle, playersList ordering, getRandomCard —
// draws from one reproducible stream, so a whole game is reproducible from a
// single seed. Production leaves it null and uses Math.random.
let seededRng: (() => number) | null = null;

export function setShuffleSeed(seed: number | null): void {
  if (seed === null) {
    seededRng = null;
    return;
  }
  // mulberry32 — small, fast, good-enough deterministic PRNG.
  let a = seed >>> 0;
  seededRng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rng(): number {
  return seededRng ? seededRng() : Math.random();
}

export function shuffle<T>(array: T[]): T[] {
  if (array.length <= 1) return array;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = array[i];
    const b = array[j];
    if (a !== undefined && b !== undefined) {
      array[i] = b;
      array[j] = a;
    }
  }
  return array;
}

// Verbose game logging is off unless NECHTO_DEBUG=true (keeps test output clean
// and the brutforce fuzzer fast).
const silent = process.env.NECHTO_DEBUG !== 'true';
export let debugCache: unknown[][] = [];
export function clearDebugCache() {
  debugCache = [];
}
export function printDebugCache() {
  each(debugCache, (log: unknown[]) => { console.log(...log) })
}
export function debugLog(...log: unknown[]) {
  if (silent) return;
  debugCache.push([...log]);
  console.log(...log)
}
