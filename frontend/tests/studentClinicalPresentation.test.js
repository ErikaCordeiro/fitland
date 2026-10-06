import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { optionalFormNumber, studentSummary } from "../src/utils/studentPresentation.js";

const cardSource = readFileSync(new URL("../src/components/StudentCard.jsx", import.meta.url), "utf8");
const studentsSource = readFileSync(new URL("../src/pages/Students.jsx", import.meta.url), "utf8");

test("student card renders missing clinical data neutrally without invented values", () => {
  assert.deepEqual(studentSummary({ age: null, weight: null, height: null, objective: null }), {
    age: "—", weight: "—", height: "—", objective: "—",
  });
  assert.doesNotMatch(cardSource, /student\.(?:age|weight|height|objective)/);
});

test("student card preserves every partial clinical value independently", () => {
  assert.deepEqual(studentSummary({ age: 42 }), { age: "42 anos", weight: "—", height: "—", objective: "—" });
  assert.deepEqual(studentSummary({ weight: 72.5 }), { age: "—", weight: "72.5 kg", height: "—", objective: "—" });
  assert.deepEqual(studentSummary({ height: 1.68 }), { age: "—", weight: "—", height: "1.68 m", objective: "—" });
  assert.deepEqual(studentSummary({ objective: "Mobilidade" }), { age: "—", weight: "—", height: "—", objective: "Mobilidade" });
});

test("student card keeps the complete student presentation unchanged", () => {
  assert.deepEqual(studentSummary({ age: 35, weight: 80, height: 1.8, objective: "Hipertrofia" }), {
    age: "35 anos", weight: "80 kg", height: "1.8 m", objective: "Hipertrofia",
  });
});

test("editing an incomplete student keeps empty numbers null instead of zero", () => {
  assert.equal(optionalFormNumber(""), null);
  assert.equal(optionalFormNumber(null), null);
  assert.equal(optionalFormNumber("  "), null);
  assert.equal(optionalFormNumber("invalid"), null);
  assert.equal(optionalFormNumber("0"), 0);
  assert.equal(optionalFormNumber("72.5"), 72.5);
  assert.match(studentsSource, /defaultValue=\{editingStudent\?\.age \?\? ""\}/);
  assert.match(studentsSource, /defaultValue=\{editingStudent\?\.objective \?\? ""\}/);
});
