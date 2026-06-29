import {each} from 'lodash';

export function shuffle<T>(array: T[]): T[] {
  if (array.length <= 1) return array;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
