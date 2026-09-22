import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/OwnerPortal.jsx", import.meta.url), "utf8");

test("successful owner upload updates preview state and shows confirmation", () => {
  assert.match(source, /const result = await apiRequest\(`\/branding\/personal\/\$\{item\.id\}\/upload\/\$\{type\}`/);
  assert.match(source, /setBrand\(result\.branding\)/);
  assert.match(source, /Logo enviada com sucesso\./);
  assert.match(source, /brand\.logo_url \? <img src=\{brand\.logo_url\}/);
});

test("upload failure keeps the existing preview and cannot show success", () => {
  assert.match(source, /catch \(err\) \{ setError\(err\.message\); setMessage\(""\); \}/);
  assert.doesNotMatch(source, /catch \(err\)[^}]*setBrand/s);
});

test("final branding save uses the PUT response before closing", () => {
  const put = source.indexOf("const savedBranding = await apiRequest");
  const update = source.indexOf("setBrand(savedBranding)", put);
  const close = source.indexOf("onClose()", update);
  assert.ok(put >= 0 && update > put && close > update);
});

test("failed final save does not close the modal", () => {
  const saveStart = source.indexOf("const save = async");
  const uploadStart = source.indexOf("const uploadBrandAsset", saveStart);
  const saveFlow = source.slice(saveStart, uploadStart);
  const catchStart = saveFlow.indexOf("catch (err)");
  assert.ok(catchStart >= 0);
  assert.doesNotMatch(saveFlow.slice(catchStart), /onClose\(\)/);
  assert.match(saveFlow.slice(catchStart), /setError\(err\.message\)/);
});
