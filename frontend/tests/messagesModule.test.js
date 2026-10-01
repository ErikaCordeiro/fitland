import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const component = fs.readFileSync(new URL("../src/components/MessageCenter.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../src/components/Sidebar.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("messages use persisted API with loading empty success and error states", () => {
  assert.match(component, /apiRequest\("\/messages\/conversations"/);
  assert.match(component, /Carregando mensagens/);
  assert.match(component, /Nenhuma conversa ainda/);
  assert.match(component, /Não foi possível carregar/);
  assert.match(app, /<PersonalMessages/);
  assert.match(app, /<StudentMessages/);
});

test("composer prevents empty and duplicate submits and renders text safely", () => {
  assert.match(component, /if \(!body \|\| sending/);
  assert.match(component, /maxLength=\{MAX_LENGTH\}/);
  assert.match(component, /message\.body/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  assert.match(component, /e\.key === "Enter" && !e\.shiftKey/);
});

test("unread badge polling pagination and responsive mobile layout exist", () => {
  assert.match(sidebar, /nav-unread-badge/);
  assert.match(component, /20000/);
  assert.match(component, /nextBefore/);
  assert.match(css, /@media\(max-width:768px\)/);
  assert.match(css, /mobile-thread-open/);
});
