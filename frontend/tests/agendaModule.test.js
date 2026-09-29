import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calendarDays, localDateKey, monthRange } from "../src/utils/agenda.js";

const agenda = fs.readFileSync(new URL("../src/pages/AgendaModule.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../src/components/Sidebar.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("agenda uses a 42-day local calendar range without UTC date conversion", () => {
  const month = new Date(2026, 8, 1);
  assert.equal(calendarDays(month).length, 42);
  assert.deepEqual(monthRange(month), { start: "2026-08-31", end: "2026-10-11", startDate: new Date(2026, 7, 31) });
  assert.equal(localDateKey(new Date(2026, 8, 30, 23, 59)), "2026-09-30");
});

test("agenda exposes real API states navigation filters and CRUD", () => {
  assert.match(agenda, /\/agenda\?start=/);
  assert.match(agenda, /Carregando agenda/);
  assert.match(agenda, /Não foi possível carregar a agenda/);
  assert.match(agenda, /Nenhum compromisso neste dia/);
  assert.match(agenda, /Novo compromisso/);
  assert.match(agenda, /method: dialog\.item \? "PATCH" : "POST"/);
  assert.match(agenda, /method: "DELETE"/);
  assert.match(agenda, /Todos/);
  assert.match(agenda, /Treinos/);
  assert.match(agenda, /Compromissos/);
  assert.doesNotMatch(agenda, /Math\.random|Erika Gomes|Lucas Martins|Amanda Lima/);
});

test("calendar and agenda are one configurable module in the UI", () => {
  assert.match(app, /<PersonalAgenda students=\{students\}/);
  assert.match(app, /<StudentCalendar/);
  assert.equal((sidebar.match(/label: "Agenda"/g) || []).length, 2);
  assert.doesNotMatch(sidebar, /label: "Calendário"/);
});

test("agenda has explicit tablet mobile and accessible touch protections", () => {
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /\.agenda-month-card \{ display: none/);
  assert.match(agenda, /aria-label="Mês anterior"/);
  assert.match(agenda, /role="alertdialog"/);
});
