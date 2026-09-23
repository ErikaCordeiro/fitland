import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const builder = readFileSync(new URL("../src/pages/WorkoutBuilder.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("AI suggestions use the authenticated student endpoint", () => {
  assert.match(app, /\/ai\/personal\/students\/\$\{studentId\}\/exercise-suggestions/);
  assert.match(builder, /Sugerir com IA/);
});

test("AI suggestions remain selectable and are never inserted automatically", () => {
  assert.match(builder, /selectedSuggestions\.has/);
  assert.match(builder, /Adicionar selecionados/);
  assert.match(builder, /onClick=\{addSelectedSuggestions\}/);
  assert.doesNotMatch(builder, /setExercises\([^)]*response\.suggestions/);
});

test("loading errors empty catalog and manual continuation remain available", () => {
  assert.match(builder, /Analisando o contexto/);
  assert.match(builder, /Cadastre exercícios no catálogo/);
  assert.match(builder, /Continue montando o treino manualmente/);
  assert.match(builder, /Continuar manualmente/);
});

test("AI errors are mapped to accessible and actionable messages", () => {
  assert.match(builder, /AI_NOT_CONFIGURED/);
  assert.match(builder, /AI_RATE_LIMITED/);
  assert.match(builder, /AI_INVALID_RESPONSE/);
  assert.match(builder, /temporariamente indisponível/);
  assert.match(builder, /semantic-dark-surface/);
});

test("suggested exercises reuse manual workout defaults", () => {
  assert.match(builder, /\.\.\.blankExercise/);
  assert.match(builder, /exerciseId: item\.exercise_id/);
  assert.match(builder, /setType: "standard"/);
});
