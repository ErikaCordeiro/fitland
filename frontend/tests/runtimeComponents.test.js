import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";

let vite;
let dashboardModule;
let ownerModule;
let workoutModule;
let apiModule;

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body><button id='opener'>Abrir</button><div id='root'></div></body></html>", { url: "http://localhost/personal/demo/dashboard" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) });
  vite = await createServer({ server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true } });
  dashboardModule = await vite.ssrLoadModule("/src/pages/PersonalDashboard.jsx");
  ownerModule = await vite.ssrLoadModule("/src/pages/OwnerPortal.jsx");
  workoutModule = await vite.ssrLoadModule("/src/pages/WorkoutBuilder.jsx");
  apiModule = await vite.ssrLoadModule("/src/services/api.js");
});

after(async () => {
  await vite?.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function render(element) {
  const host = document.getElementById("root");
  host.replaceChildren();
  const root = createRoot(host);
  await act(async () => { root.render(element); });
  return { host, root };
}

test("dashboard uses a skeleton and never paints invented pending assessments", async () => {
  const PersonalDashboard = dashboardModule.default;
  const common = { students: [], workouts: [], branding: { modules: {} }, onNavigate() {} };
  const loading = await render(React.createElement(PersonalDashboard, { ...common, dataStatus: "loading" }));
  assert.ok(loading.host.querySelector(".dashboard-skeleton"));
  assert.equal(loading.host.querySelector(".admin-kpis"), null);
  await act(async () => loading.root.unmount());

  const ready = await render(React.createElement(PersonalDashboard, { ...common, dataStatus: "success" }));
  assert.ok(ready.host.querySelector(".admin-kpis"));
  assert.doesNotMatch(ready.host.textContent, /Avaliações pendentes/);
  await act(async () => ready.root.unmount());
});

test("owner personal modal exposes dialog semantics, traps focus and closes with Escape", async () => {
  const opener = document.getElementById("opener");
  opener.focus();
  let closed = false;
  const modal = await render(React.createElement(ownerModule.PersonalModal, {
    item: null,
    onClose() { closed = true; },
    onSaved() {},
  }));
  const dialog = modal.host.querySelector('[role="dialog"][aria-modal="true"]');
  assert.ok(dialog);
  assert.ok(dialog.getAttribute("aria-labelledby"));
  assert.equal(document.activeElement?.getAttribute("aria-label"), "Fechar");
  dialog.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(closed, true);
  await act(async () => modal.root.unmount());
  assert.equal(document.activeElement, opener);
});

test("workout builder gives persistent labels to exercise prescription fields", async () => {
  const WorkoutBuilder = workoutModule.default;
  const view = await render(React.createElement(WorkoutBuilder, {
    students: [{ id: "student-1", name: "Aluno Teste" }],
    workouts: [],
    availableExercises: [],
    onSaveWorkout: async () => {},
  }));
  for (const label of ["Nome do exercício", "Séries", "Repetições", "Descanso", "Carga", "Observações e execução"]) {
    assert.match(view.host.textContent, new RegExp(label));
  }
  assert.equal(view.host.querySelector('input[placeholder="Nome do exercício"]')?.required, true);
  await act(async () => view.root.unmount());
});

test("access tokens remain in memory and legacy browser storage is scrubbed", () => {
  localStorage.setItem("fitland_personal_token", "legacy-local-token");
  sessionStorage.setItem("fitland_personal_session_token", "legacy-session-token");
  apiModule.setToken("memory-only-token", true, "personal");
  assert.equal(apiModule.getToken("personal"), "memory-only-token");
  assert.equal(localStorage.getItem("fitland_personal_token"), null);
  assert.equal(sessionStorage.getItem("fitland_personal_session_token"), null);
  apiModule.clearToken("personal");
  assert.equal(apiModule.getToken("personal"), null);
});
