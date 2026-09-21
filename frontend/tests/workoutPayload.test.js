import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkoutPayload } from "../src/utils/workoutPayload.js";

test("workout payload preserves standard, biset and drop-set configuration", () => {
  const payload = buildWorkoutPayload({ studentId: "student-1", name: "QA", duration: "60 min" }, [
    { exerciseId: "exercise-1", sets: 3, reps: "12", rest: "60s", load: "20kg", setType: "standard", techniqueConfig: {} },
    { exerciseId: "exercise-2", sets: 4, reps: "10", rest: "75s", load: "30", setType: "biset", techniqueConfig: { components: [{ exerciseName: "A" }, { exerciseName: "B" }] } },
    { exerciseId: "exercise-3", sets: 3, reps: "8", rest: "90s", load: "40", setType: "drop_set", techniqueConfig: { drop_count: 3, drops: [{ prescribedLoad: "40" }, { prescribedLoad: "30" }, { prescribedLoad: "20" }] } },
  ]);
  assert.equal(payload.duration_minutes, 60);
  assert.deepEqual(payload.exercises.map((item) => item.set_type), ["standard", "biset", "drop_set"]);
  assert.equal(payload.exercises[0].load, 20);
  assert.equal(payload.exercises[1].technique_config.components[1].exerciseName, "B");
  assert.equal(payload.exercises[2].technique_config.drop_count, 3);
});
