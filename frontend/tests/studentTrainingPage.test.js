import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/StudentPortal.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("student page separates assigned workouts, weekly agenda and completed history", () => {
  assert.match(page, /Agenda semanal/);
  assert.match(page, /Sem dia definido/);
  assert.match(page, /Disponíveis para acesso, mas ainda não incluídos na agenda semanal/);
  assert.match(page, /Treinos concluídos/);
  assert.match(page, /Nenhum treino concluído ainda/);
  assert.doesNotMatch(page, /Dia livre para recuperação/);
});

test("light training page uses solid semantic surfaces without forced dark hero", () => {
  assert.match(styles, /body\.theme-light \.student-layout-shell \.student-training-page \.training-hero-card[\s\S]*?background: #fff !important/);
  assert.match(styles, /box-shadow: 0 8px 24px rgba\(30,34,38,\.08\) !important/);
  assert.match(styles, /body\.theme-light \.student-layout-shell \.student-training-page \.weekday-card[\s\S]*?background: #f7f8f8/);
});

test("weekly agenda wraps on desktop and becomes a vertical list on mobile", () => {
  assert.match(styles, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 150px\), 1fr\)\) !important/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.student-training-page \.weekly-workout-grid \{ grid-template-columns: 1fr !important/);
  assert.match(styles, /\.unscheduled-workout-list article button \{ width: 100%/);
});
