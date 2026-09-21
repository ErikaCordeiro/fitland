import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (file) => readFileSync(new URL(`../src/pages/${file}`, import.meta.url), "utf8");

test("modules without persistence render honest empty states before legacy sample content", () => {
  const expectations = {
    "StudentDiet.jsx": "Nenhum plano alimentar disponível",
    "PersonalDiet.jsx": "Nenhum plano alimentar cadastrado",
    "PersonalAgenda.jsx": "Nenhum compromisso cadastrado",
    "PersonalReports.jsx": "Nenhum relatório disponível",
    "PersonalProgress.jsx": "Nenhum progresso registrado ainda",
    "PersonalStudentProgress.jsx": "Sem dados individuais de progresso",
    "StudentPayments.jsx": "Sem dados de pagamento",
    "PersonalMessages.jsx": "Nenhuma mensagem disponível",
    "StudentMessages.jsx": "Nenhuma mensagem disponível",
    "StudentFiles.jsx": "Nenhum arquivo disponível",
    "PersonalAssessments.jsx": "Nenhuma avaliação disponível",
    "StudentAssessments.jsx": "Nenhuma avaliação disponível",
  };

  for (const [file, message] of Object.entries(expectations)) {
    const contents = source(file);
    const componentStart = contents.indexOf("export default function");
    const emptyState = contents.indexOf(message, componentStart);
    assert.ok(emptyState > componentStart, `${file} must render its empty state`);
    assert.ok(contents.slice(componentStart, emptyState).includes("return <section"), `${file} must return before sample content`);
  }
});

test("production app does not import tenant student or workout fixtures", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /mockStudents|mockWorkouts|data\/mockData/);
});
