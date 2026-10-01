import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const personal = fs.readFileSync(new URL("../src/pages/PersonalAssessments.jsx", import.meta.url), "utf8");
const student = fs.readFileSync(new URL("../src/pages/StudentAssessments.jsx", import.meta.url), "utf8");
const progress = fs.readFileSync(new URL("../src/components/ProgressOverview.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("personal assessments expose real CRUD states and factual comparison", () => {
  assert.match(personal, /Carregando avaliações/);
  assert.match(personal, /Nenhuma avaliação registrada ainda/);
  assert.match(personal, /Não foi possível carregar/);
  assert.match(personal, /method: item \? "PATCH" : "POST"/);
  assert.match(personal, /method: "DELETE"/);
  assert.match(personal, /Primeira avaliação registrada/);
  assert.match(personal, /Diferença:/);
  assert.doesNotMatch(personal, /Erika Gomes|18\/06\/2025|classifyFat|Jackson/);
});

test("student assessments are read-only and use the authenticated endpoint", () => {
  assert.match(student, /apiRequest\("\/assessments"\)/);
  assert.doesNotMatch(student, /method:\s*"(?:POST|PATCH|DELETE)"/);
  assert.match(student, /Histórico registrado pelo seu Personal/);
});

test("progress renders real selectable measurement series", () => {
  assert.match(progress, /measurementKey/);
  assert.match(progress, /data\.measurements\.map/);
  assert.match(progress, /selectedMeasurement\.points/);
  assert.match(progress, /módulo Avaliações está desativado/);
});

test("protected tenant routes pass their slug to public branding", () => {
  assert.match(app, /brandSlug=\{personalLoginMatch\?\.\[1\] \|\| requestedLoginContext\?\.slug \|\| ""\}/);
});

test("assessment layout protects mobile inputs and avoids wide tables", () => {
  assert.match(styles, /@media \(max-width: 768px\)/);
  assert.match(styles, /@media \(max-width: 375px\)/);
  assert.match(styles, /\.assessment-input-grid/);
  assert.match(styles, /min-height: 46px/);
});
