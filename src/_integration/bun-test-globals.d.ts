// Bun injects the jest-compatible test API as globals during `bun test`.
// Declare them (typed from `bun:test`) so test files don't need explicit imports.
import type * as BunTest from "bun:test";

declare global {
  const describe: typeof BunTest.describe;
  const it: typeof BunTest.it;
  const test: typeof BunTest.test;
  const expect: typeof BunTest.expect;
  const beforeAll: typeof BunTest.beforeAll;
  const afterAll: typeof BunTest.afterAll;
  const beforeEach: typeof BunTest.beforeEach;
  const afterEach: typeof BunTest.afterEach;
  const jest: typeof BunTest.jest;
  const mock: typeof BunTest.mock;
  const spyOn: typeof BunTest.spyOn;
}

export {};
