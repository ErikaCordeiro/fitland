import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { downloadBrowserFile } from "../src/utils/fileDownload.js";

test("audit export receives a file, clicks a download and revokes the object URL", async () => {
  const events = [];
  const anchor = {
    href: "", download: "", hidden: false,
    click: () => events.push("click"),
    remove: () => events.push("remove"),
  };
  const documentRef = {
    createElement: (tag) => { assert.equal(tag, "a"); return anchor; },
    body: { appendChild: (node) => { assert.equal(node, anchor); events.push("append"); } },
  };
  const urlRef = {
    createObjectURL: (blob) => { assert.equal(blob.size, 3); events.push("create"); return "blob:fitland"; },
    revokeObjectURL: (url) => { assert.equal(url, "blob:fitland"); events.push("revoke"); },
  };
  const result = await downloadBrowserFile(
    async () => ({ blob: new Blob(["csv"]), filename: "fitland-logs-2026-09-28.csv" }),
    { documentRef, urlRef },
  );
  assert.equal(anchor.href, "blob:fitland");
  assert.equal(anchor.download, "fitland-logs-2026-09-28.csv");
  assert.deepEqual(events, ["create", "append", "click", "remove", "revoke"]);
  assert.deepEqual(result, { filename: "fitland-logs-2026-09-28.csv", size: 3 });
});

test("Owner logs button requests the authenticated CSV endpoint", () => {
  const owner = readFileSync(new URL("../src/pages/OwnerPortal.jsx", import.meta.url), "utf8");
  assert.match(owner, /apiDownload\("\/owner\/audit-logs\/export"\)/);
  assert.match(owner, /downloadBrowserFile/);
  assert.match(owner, /Exportar CSV/);
});

test("global favicon and PWA manifest use Fitland assets", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const manifest = readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(index, /fitland-icon\.svg\?v=2/);
  assert.match(index, /<title>Fitland<\/title>/);
  assert.doesNotMatch(manifest, /Thiago|MuscleBoom|lion-juda/i);
  assert.match(manifest, /pwa-icon-192\.png\?v=2/);
  assert.match(worker, /fitland-icon\.svg\?v=2/);
  assert.doesNotMatch(worker, /lion-juda-logo/);
});
