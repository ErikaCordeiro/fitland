import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

test("service worker ignores unsupported URL schemes", () => {
  assert.match(source, /\["http:",\s*"https:"\]\.includes\(url\.protocol\)/);
});

test("service worker bypasses dynamic and non-GET requests", () => {
  assert.match(source, /request\.method !== "GET"/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /url\.pathname\.startsWith\("\/auth\/"\)/);
  assert.match(source, /url\.pathname\.startsWith\("\/uploads\/"\)/);
});

test("service worker fallbacks always resolve to a Response", () => {
  assert.doesNotMatch(source, /catch\(\(\) => caches\.match/);
  assert.match(source, /\(await caches\.match\("\/"\)\) \|\| Response\.error\(\)/);
  assert.match(source, /\(await caches\.match\(request\)\) \|\| Response\.error\(\)/);
});

test("service worker forces an update and removes old caches", () => {
  assert.match(source, /`\$\{CACHE_PREFIX\}v7`/);
  assert.match(source, /self\.skipWaiting\(\)/);
  assert.match(source, /self\.clients\.claim\(\)/);
  assert.match(source, /caches\.delete\(key\)/);
});
