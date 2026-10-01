import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const personal = fs.readFileSync(new URL("../src/pages/PersonalFinance.jsx", import.meta.url), "utf8");
const student = fs.readFileSync(new URL("../src/pages/StudentPayments.jsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../src/components/Sidebar.jsx", import.meta.url), "utf8");
const registry = fs.readFileSync(new URL("../../backend/app/services/module_registry.py", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../../backend/app/services/finance_service.py", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("finance is one catalog module shared by Personal and Student", () => {
  assert.equal((registry.match(/ModuleDefinition\("finance"/g) || []).length, 1);
  assert.doesNotMatch(registry, /ModuleDefinition\("payments"/);
  assert.match(sidebar, /id: "finance", label: "Meus Pagamentos"/);
});
test("personal finance uses real charges payments filters and BRL", () => {
  assert.match(personal, /\/finance\/charges/); assert.match(personal, /\/finance\/summary/);
  assert.match(personal, /Registrar pagamento/); assert.match(personal, /Cancelar/); assert.match(personal, /Intl\.NumberFormat\("pt-BR"/);
  assert.doesNotMatch(personal, /localStorage|Gemini|Pagar agora|Receita prevista|Erika/);
});
test("student finance is read-only without fake gateway actions", () => {
  assert.match(student, /\/finance\/charges/); assert.match(student, /Meus Pagamentos/);
  assert.doesNotMatch(student, /method:\s*"POST"|Pagar agora|PIX|QrCode|checkout|localStorage/i);
});
test("overpayment is protected by transaction lock and UI is responsive", () => {
  assert.match(service, /with_for_update/); assert.match(service, /excede o saldo/);
  assert.match(css, /@media\(max-width:768px\)[\s\S]*\.finance-summary-grid/);
  assert.match(css, /@media\(max-width:375px\)[\s\S]*\.finance-charge-cards/);
  assert.match(css, /min-height:44px/);
});
