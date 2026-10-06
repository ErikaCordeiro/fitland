import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const requestPage = fs.readFileSync(new URL("../src/pages/StudentAccessRequest.jsx", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../src/pages/Login.jsx", import.meta.url), "utf8");
const students = fs.readFileSync(new URL("../src/pages/Students.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const routing = fs.readFileSync(new URL("../src/utils/authRouting.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("student signup opens the contextual access request instead of creating a local account", () => {
  assert.match(login, /context === "student"/);
  assert.match(login, /\/personal\/\$\{encodeURIComponent\(brandSlug\)\}\/aluno\/cadastro/);
  assert.match(routing, /primeiro-acesso\|cadastro/);
  assert.match(app, /StudentAccessRequest/);
  assert.doesNotMatch(app, /readPendingStudents|savePendingStudents|crypto\.randomUUID\(\).*pending/);
});

test("public request form is minimal branded and never asks for a password or health data", () => {
  assert.match(requestPage, /firstAccessBrandingEndpoint\(slug\)/);
  assert.match(requestPage, /student-access-requests\/public/);
  assert.match(requestPage, /first_name/);
  assert.match(requestPage, /last_name/);
  assert.match(requestPage, /type="email"/);
  assert.match(requestPage, /status === "saving"/);
  assert.match(requestPage, /Solicitação enviada!/);
  assert.doesNotMatch(requestPage, /password|weight|height|objective|CPF|documento/i);
});

test("personal requests panel lists counts and uses protected approval endpoints", () => {
  assert.match(students, /\/student-access-requests/);
  assert.match(students, /Solicitações <span>\{requests\.length\}/);
  assert.match(students, /student-access-requests\/\$\{request\.id\}\/\$\{action\}/);
  assert.match(students, /reviewRequest\(request, "approve"\)/);
  assert.match(students, /reviewRequest\(request, "reject"\)/);
  assert.match(students, /Aprovar e enviar convite/);
  assert.match(students, /if \(reviewingId\) return/);
});

test("request and review layouts retain explicit mobile protections", () => {
  assert.match(css, /\.student-access-request/);
  assert.match(css, /\.student-list-tabs/);
  assert.match(css, /\.pending-card-actions \{ display: grid; grid-template-columns: 1fr; \}/);
  assert.match(css, /width: min\(560px, 100%\)/);
});
