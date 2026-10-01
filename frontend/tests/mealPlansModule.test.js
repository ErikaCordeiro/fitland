import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const personal = fs.readFileSync(new URL("../src/pages/PersonalDiet.jsx", import.meta.url), "utf8");
const student = fs.readFileSync(new URL("../src/pages/StudentDiet.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("personal meal plan builder uses structured persistent API", () => {
  assert.match(personal, /\/meal-plans\?student_id=/);
  assert.match(personal, /method: draft\.id \? "PUT" : "POST"/);
  assert.match(personal, /Adicionar refeição/);
  assert.match(personal, /Adicionar alimento/);
  assert.match(personal, /Mover refeição para cima/);
  assert.match(personal, /Mover alimento para baixo/);
  assert.match(personal, /\/archive/);
  assert.doesNotMatch(personal, /localStorage|Gemini|Gerar sugestão com IA|calorias alvo/i);
});

test("student meal plan is read-only and factual", () => {
  assert.match(student, /\/meal-plans\/active/);
  assert.match(student, /Meu Plano Alimentar/);
  assert.match(student, /Nenhum plano alimentar disponível no momento/);
  assert.doesNotMatch(student, /method:\s*"POST"|Salvar|Editar|Excluir|localStorage|kcal|macros|IA/);
  assert.match(app, /activePage === "diet" && <StudentDiet/);
  assert.match(app, /activePage === "diet" && <PersonalDiet students=\{students\}/);
});

test("meal plans have explicit responsive and accessible protections", () => {
  assert.match(css, /@media\(max-width:768px\)[\s\S]*\.meal-builder/);
  assert.match(css, /@media\(max-width:375px\)[\s\S]*\.meal-item-editor/);
  assert.match(css, /min-height:44px/);
  assert.match(personal, /aria-label="Mover refeição para cima"/);
  assert.match(personal, /aria-label="Remover alimento"/);
});
