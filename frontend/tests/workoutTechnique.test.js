import test from "node:test";
import assert from "node:assert/strict";
import { workoutTechniqueDetails } from "../src/utils/workoutTechnique.js";

test("standard is identified without invented technique items", () => {
  assert.deepEqual(workoutTechniqueDetails({ setType: "standard" }), { type: "standard", label: "STANDARD", items: [] });
});

test("biset displays persisted components", () => {
  const details = workoutTechniqueDetails({ set_type: "biset", technique_config: { components: [
    { exerciseName: "Remada", prescribedRepetitions: "10", prescribedLoad: "30" },
    { exerciseName: "Rosca", prescribedRepetitions: "10", prescribedLoad: "12" }
  ] } });
  assert.equal(details.label, "BISET");
  assert.deepEqual(details.items.map((item) => item.name), ["Remada", "Rosca"]);
  assert.deepEqual(details.items.map((item) => [item.load, item.repetitions]), [["30", "10"], ["12", "10"]]);
});

test("drop set displays persisted stages", () => {
  const details = workoutTechniqueDetails({ setType: "drop_set", techniqueConfig: { drops: [
    { prescribedLoad: "40", prescribedRepetitions: "8" },
    { prescribedLoad: "30", prescribedRepetitions: "8" }
  ] } });
  assert.equal(details.label, "DROP SET");
  assert.deepEqual(details.items.map((item) => item.load), ["40", "30"]);
});
