import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const students = fs.readFileSync(new URL("../src/pages/Students.jsx", import.meta.url), "utf8");
const firstAccess = fs.readFileSync(new URL("../src/pages/StudentFirstAccess.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const routing = fs.readFileSync(new URL("../src/utils/authRouting.js", import.meta.url), "utf8");
const workout = fs.readFileSync(new URL("../src/pages/WorkoutBuilder.jsx", import.meta.url), "utf8");
const assessments = fs.readFileSync(new URL("../src/pages/PersonalAssessments.jsx", import.meta.url), "utf8");

test("workout top and bottom saves share one guarded submit handler", () => {
  assert.equal((workout.match(/type="submit" disabled=\{saving\}/g) || []).length, 2);
  assert.match(workout, /if \(saving\) return/);
  assert.match(workout, /Criar treino/);
  assert.match(workout, /onClick=\{startNewWorkout\}/);
});

test("assessment UI includes coherent forearm lateralization and one glute measure", () => {
  assert.match(assessments, /right_forearm.*Antebraço direito/);
  assert.match(assessments, /left_forearm.*Antebraço esquerdo/);
  assert.match(assessments, /glutes.*Circunferência do glúteo/);
});

test("personal student editor exposes access states without passwords", () => {
  assert.match(students, /Acesso à plataforma/);
  assert.match(students, /Enviar acesso/);
  assert.match(students, /Reenviar convite/);
  assert.doesNotMatch(students, /password_hash|Senha do aluno/);
});

test("first access is contextual, accessible, and never stores its token", () => {
  assert.match(firstAccess, /student-invites\/validate/);
  assert.match(firstAccess, /student-invites\/activate/);
  assert.match(firstAccess, /minLength="10"/);
  assert.match(firstAccess, /Mostrar senha/);
  assert.doesNotMatch(firstAccess, /localStorage|sessionStorage/);
  assert.match(routing, /aluno\\\/primeiro-acesso/);
  assert.match(app, /onboarding_completed_at/);
  assert.match(app, /\/users\/me\/onboarding/);
});
