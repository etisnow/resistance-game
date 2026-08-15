import {each} from 'lodash';

// mulberry32 — small, fast, deterministic PRNG. Every Game owns its own seeded
// stream (game.rng), so the whole game — deck deal/reshuffle, playersList
// ordering, getRandomCard — is reproducible from the game's seed (logged as the
// first game-log line). Concurrent games stay independent because each has its
// own stream.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates shuffle drawing from the supplied RNG (defaults to Math.random
// for the few non-game callers, e.g. the fuzz bot's own choices).
export function shuffle<T>(array: T[], rng: () => number = Math.random): T[] {
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

// Verbose game logging is off unless resistance_DEBUG=true (keeps test output clean
// and the brutforce fuzzer fast).
const silent = process.env.resistance_DEBUG !== 'true';
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
