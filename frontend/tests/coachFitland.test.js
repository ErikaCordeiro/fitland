import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("Coach Fitland uses authenticated backend endpoints and memory-only context", () => {
  const source = read("pages/CoachIA.jsx");
  assert.match(source, /apiRequest\("\/coach\/messages"/);
  assert.match(source, /apiRequest\("\/coach\/escalations"/);
  assert.match(source, /useState\(null\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|Gemini|OpenAI/);
});

test("Coach Fitland escalation requires an explicit student action", () => {
  const source = read("pages/CoachIA.jsx");
  assert.match(source, /onClick=\{\(\) => escalate\(message\.escalation\.token\)\}/);
  assert.match(source, /Encaminhar ao Personal/);
});

test("Personal surfaces do not expose the student Coach", () => {
  const sidebar = read("components/Sidebar.jsx");
  const dashboard = read("pages/PersonalDashboard.jsx");
  const layout = read("layouts/PersonalLayout.jsx");
  assert.doesNotMatch(sidebar, /\["Coach Fitland"[^\n]+"personal"/);
  assert.doesNotMatch(dashboard, /Coach IA|Coach Fitland/);
  assert.doesNotMatch(layout, /onCoach/);
});

test("student navigation exposes the canonical Coach route", () => {
  const app = read("App.jsx");
  const sidebar = read("components/Sidebar.jsx");
  assert.match(app, /"\/aluno\/coach"/);
  assert.match(sidebar, /Coach Fitland/);
});
