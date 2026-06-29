/**
 * Server bundler — bundles the Bun game server into a single dist/server file.
 * Target `bun` so Bun built-ins (Bun.file) and node compat (http) are preserved.
 */
import { rm, mkdir } from "fs/promises";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "dist/server");

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const result = await Bun.build({
    entrypoints: [join(ROOT, "src/server/index.ts")],
    outdir: OUT,
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    minify: false,
    naming: { entry: "index.js" },
  });

  if (!result.success) {
    console.error("Server build failed:");
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  console.log(`Server built -> ${join(OUT, "index.js")}`);
}

main();
