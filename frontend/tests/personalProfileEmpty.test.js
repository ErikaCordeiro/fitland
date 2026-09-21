import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const about = readFileSync(new URL("../src/pages/AboutPersonal.jsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/pages/PersonalSettings.jsx", import.meta.url), "utf8");

test("personal profile without persisted source has no invented biography or experience", () => {
  assert.doesNotMatch(app + about, /10\+ anos|Hipertrofia, emagrecimento e performance|Personal trainer focado/);
  assert.match(about, /Informações ainda não cadastradas/);
  assert.match(about, /branding\?\.display_name/);
});

test("settings do not claim a paid plan or active integrations without an API source", () => {
  assert.doesNotMatch(settings, /Plano Premium|<em>Ativado<\/em>/);
  assert.match(settings, /Plano: não disponível/);
  assert.match(settings, /apiRequest\("\/branding\/me"\)/);
});
