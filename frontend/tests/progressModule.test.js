import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/ProgressModule.jsx", import.meta.url), "utf8");
const view = readFileSync(new URL("../src/components/ProgressOverview.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("personal progress selects an owned student and period through the aggregate API", () => {
  assert.match(page, /progress\/overview\/\$\{studentId\}\?period_days=\$\{period\}/);
  assert.match(page, /Selecionar aluno/);
  assert.match(page, /30 dias/);
  assert.match(page, /12 meses/);
});

test("student progress derives identity from the authenticated endpoint", () => {
  assert.match(page, /apiRequest\(`\/progress\/overview\?period_days=\$\{period\}`\)/);
  assert.doesNotMatch(page, /studentId.*StudentProgress/);
});

test("progress exposes loading empty error and real-data states without fake metrics", () => {
  for (const text of ["Carregando progresso", "Nenhum aluno disponível", "Não foi possível carregar o progresso", "Nenhum treino concluído ainda", "Sem dados de carga executada", "Sem histórico de medidas"])
    assert.match(page + view, new RegExp(text));
  assert.doesNotMatch(view, /Math\.random|Score do Leão|Insights da IA|70kg|80kg/);
  assert.doesNotMatch(view, /Invalid Date|undefined|NaN/);
});

test("progress renders accessible text alongside charts and mobile-safe grids", () => {
  assert.match(view, /role="img"/);
  assert.match(view, /aria-label=/);
  assert.match(view, /<ol>/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /\.progress-summary, \.progress-content-grid, \.progress-foot-grid \{ grid-template-columns: 1fr/);
  assert.match(css, /grid-template-columns: 1fr/);
});

test("App uses the shared progress implementation for Personal and Student", () => {
  assert.match(app, /StudentProgress/);
  assert.match(app, /PersonalProgressModule students=\{students\}/);
});
