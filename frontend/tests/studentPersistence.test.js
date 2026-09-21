import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("student form persists through the authenticated students API", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../src/pages/Students.jsx", import.meta.url), "utf8");
  assert.match(app, /apiRequest\(student\.id \? `\/students\/\$\{student\.id\}` : "\/students"/);
  assert.match(app, /method: student\.id \? "PATCH" : "POST"/);
  assert.doesNotMatch(app, /onSaveStudent=\{\(student\).*crypto\.randomUUID/s);
  assert.match(form, /await onSaveStudent/);
  assert.match(form, /disabled=\{saving\}/);
  assert.match(form, /criação de login e o envio de convite ainda não estão disponíveis/);
  const card = readFileSync(new URL("../src/components/StudentCard.jsx", import.meta.url), "utf8");
  assert.match(card, /Boolean\(student\.user_id \|\| student\.userId\)/);
  assert.match(card, /Acesso não criado/);
});

test("progress distinguishes loading, empty, data and error states", () => {
  const source = readFileSync(new URL("../src/pages/PersonalProgress.jsx", import.meta.url), "utf8");
  assert.match(source, /status === "loading"/);
  assert.match(source, /status === "error"/);
  assert.match(source, /Nenhum progresso registrado ainda/);
  assert.match(source, /history\.map/);
  assert.match(source, /setStatus\("ready"\)/);
});
