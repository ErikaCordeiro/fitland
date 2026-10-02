import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const personal = fs.readFileSync(new URL("../src/pages/PersonalFiles.jsx", import.meta.url), "utf8");
const student = fs.readFileSync(new URL("../src/pages/StudentFiles.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../src/components/Sidebar.jsx", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

test("files module uses persisted private API without sample data", () => {
  assert.match(personal, /apiRequest\("\/files"/);
  assert.match(personal, /visible_to_student/);
  assert.match(personal, /10 \* 1024 \* 1024/);
  assert.match(personal, /allowedTypes\.has/);
  assert.match(personal, /Editar título/);
  assert.match(student, /apiRequest\("\/files"\)/);
  assert.match(student, /apiDownload\(`\/files\/\$\{file\.id\}\/download`\)/);
  assert.doesNotMatch(personal + student, /initialFiles|base64|data:image/);
});

test("personal and student navigation are guarded by the shared files flag", () => {
  assert.match(sidebar, /\{ id: "files", label: "Arquivos"/);
  assert.match(app, /<PersonalFiles students=\{students\}/);
  assert.match(app, /<StudentFiles \/>/);
});

test("service worker bypasses authenticated file API requests", () => {
  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
});
