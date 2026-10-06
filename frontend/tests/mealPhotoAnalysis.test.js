import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { confidenceLabel, formatFoodEstimate, validateMealPhoto } from "../src/utils/mealPhotoAnalysis.js";

const component = readFileSync(new URL("../src/components/MealPhotoAnalyzer.jsx", import.meta.url), "utf8");
const dietPage = readFileSync(new URL("../src/pages/StudentDiet.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("meal photo is selected locally and only sent by the explicit analyze action", () => {
  assert.match(component, /capture="environment"/);
  assert.match(component, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(component, /URL\.createObjectURL/);
  assert.match(component, /onClick=\{analyze\}/);
  assert.doesNotMatch(component.match(/const chooseFile[\s\S]*?const analyze/)?.[0] || "", /apiRequest/);
  assert.match(component, /state === "analyzing"/);
  assert.match(component, /body\.append\("photo", file\)/);
});

test("photo analysis is independent from plan availability and has responsive states", () => {
  assert.match(dietPage, /<MealPhotoAnalyzer \/>/);
  assert.match(styles, /@media\(max-width:768px\).*meal-photo-preview/);
  assert.match(styles, /@media\(max-width:375px\).*meal-photo-analyzer/);
  assert.match(component, /Nenhum alimento foi identificado com segurança/);
  assert.match(component, /Analisar outra foto/);
});

test("visual estimates remain approximate and do not add nutrition values", () => {
  assert.equal(formatFoodEstimate({ estimated_amount: 140, unit: "g" }), "aprox. 140 g");
  assert.equal(formatFoodEstimate({ range_min: 80, range_max: 120, unit: "g" }), "aprox. 80-120 g");
  assert.equal(formatFoodEstimate({ estimated_amount: 2, unit: "slice" }), "aprox. 2 fatia(s)");
  assert.equal(formatFoodEstimate({}), "Quantidade não estimável com segurança");
  assert.equal(confidenceLabel("low"), "Confiança baixa");
  assert.doesNotMatch(component, /calorias|macronutrientes|prote[ií]na|carboidrato/i);
});

test("client rejects unsupported formats and oversized images", () => {
  assert.match(validateMealPhoto({ type: "image/svg+xml", size: 20 }), /JPEG/);
  assert.match(validateMealPhoto({ type: "image/png", size: 6 * 1024 * 1024 }), /5 MB/);
  assert.equal(validateMealPhoto({ type: "image/webp", size: 1024 }), "");
});
