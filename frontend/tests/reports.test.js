import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("reports use one aggregated tenant API and never calculate from all sessions in the browser", () => {
  const source = read("pages/PersonalReports.jsx");
  assert.match(source, /\/reports\/overview/);
  assert.match(source, /\/reports\/export\.csv/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|Gemini|Coach IA|dangerouslySetInnerHTML/);
});

test("reports expose factual empty states filters BRL and responsive protections", () => {
  const page = read("pages/PersonalReports.jsx");
  const css = read("styles/global.css");
  assert.match(page, /Nenhum treino concluído neste período/);
  assert.match(page, /Sem treino registrado no período/);
  assert.match(page, /currency: "BRL"/);
  assert.match(css, /@media \(max-width: 340px\)/);
  assert.match(css, /\.reports-activity-list button/);
});
