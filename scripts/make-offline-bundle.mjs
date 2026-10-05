#!/usr/bin/env node
/**
 * Downloads every tarball referenced by package-lock.json into a real npm cache
 * folder, so the project can be installed on an air-gapped machine with zero
 * internet access.
 *
 *   # on a machine WITH internet
 *   npm run bundle:offline
 *
 *   # on the air-gapped bank server (no network at all)
 *   npm run install:offline
 *
 * Why `npm cache add` instead of fetching tarballs by hand:
 * npm's cache is two-part. `content-v2/` holds the bytes keyed by integrity hash,
 * but `index-v5/` holds the URL -> content mapping that npm actually uses to
 * resolve a package. Writing only the blobs produces a cache that looks populated
 * but still fails with ENOTCACHED. Delegating to `npm cache add` writes both
 * halves in the correct format, so `npm ci --offline` resolves every URL locally
 * and still verifies the sha512 integrity recorded in package-lock.json.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, ".npm-offline-cache");

// On Windows `npm` resolves to npm.cmd, a batch shim that execFile cannot spawn
// directly (ENOENT). Resolve the real path and run it via the shell.
const NPM =
  process.platform === "win32"
    ? join(dirname(process.execPath), "npm.cmd")
    : "npm";

const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));

// Unique tarball URLs. One version can be referenced from several dependency
// paths when npm hoists it, so dedupe by URL.
const byUrl = new Map();
for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
  if (!meta.resolved || !meta.integrity) continue;
  if (!meta.resolved.startsWith("http")) continue;
  byUrl.set(meta.resolved, meta.pkgPath);
}

const entries = [...byUrl.entries()];
console.log(`Lockfile references ${entries.length} unique tarballs.`);
console.log(`Caching into: ${CACHE}\n`);

const CONCURRENCY = 8;
let cursor = 0;
let ok = 0;
const failed = [];

async function worker() {
  while (cursor < entries.length) {
    const [url, pkgPath] = entries[cursor++];
    try {
      // --prefer-offline lets npm reuse an existing local copy; --cache redirects
      // the write into the bundle folder instead of the user's global cache.
      // Quote the command: the default install path ("C:\Program Files\nodejs")
      // contains a space, which cmd.exe would otherwise split into two arguments.
      await run(
        `"${NPM}" cache add "${url}" --cache "${CACHE}" --prefer-offline --no-audit --no-fund`,
        { cwd: root, windowsHide: true, maxBuffer: 10 * 1024 * 1024, shell: true },
      );
      ok++;
      if (ok % 100 === 0) console.log(`  ...${ok}/${entries.length}`);
    } catch (err) {
      const detail = (err.stderr || err.message || "").toString().split("\n")[0];
      failed.push({ url, pkgPath, error: detail });
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nCached:  ${ok}`);
console.log(`Failed:  ${failed.length}`);

if (failed.length) {
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(CACHE, { recursive: true });
  await writeFile(join(CACHE, "FAILED.json"), JSON.stringify(failed, null, 2));
  console.error("\nSome tarballs could not be fetched. See .npm-offline-cache/FAILED.json");
  for (const f of failed.slice(0, 20)) console.error(`  ${f.pkgPath}: ${f.error}`);
  process.exit(1);
}

const { writeFile, mkdir } = await import("node:fs/promises");
await mkdir(CACHE, { recursive: true });
await writeFile(
  join(CACHE, "BUNDLE-INFO.txt"),
  [
    `Generated: ${new Date().toISOString()}`,
    `Package:   ${lock.name}@${lock.version}`,
    `Lockfile:  v${lock.lockfileVersion}`,
    `Tarballs:  ${entries.length}`,
    "",
    "Install offline with:",
    "  npm run install:offline",
    "",
  ].join("\n"),
);

console.log(`\nBundle ready at: ${CACHE}`);
console.log("Install on the offline machine with:");
console.log("  npm run install:offline");

