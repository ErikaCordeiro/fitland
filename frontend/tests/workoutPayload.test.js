import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWorkoutPayload, instructionVideoPayload } from "../src/utils/workoutPayload.js";

test("workout payload preserves standard, biset and drop-set configuration", () => {
  const payload = buildWorkoutPayload({ studentId: "student-1", name: "QA", duration: "60 min", dayOfWeek: "Quinta" }, [
    { exerciseId: "exercise-1", sets: 3, reps: "12", rest: "60s", load: "20kg", setType: "standard", techniqueConfig: {} },
    { exerciseId: "exercise-2", sets: 4, reps: "10", rest: "75s", load: "30", setType: "biset", techniqueConfig: { components: [{ exerciseName: "A" }, { exerciseName: "B" }] } },
    { exerciseId: "exercise-3", sets: 3, reps: "8", rest: "90s", load: "40", setType: "drop_set", techniqueConfig: { drop_count: 3, drops: [{ prescribedLoad: "40" }, { prescribedLoad: "30" }, { prescribedLoad: "20" }] } },
  ]);
  assert.equal(payload.duration_minutes, 60);
  assert.equal(payload.day_of_week, "Quinta");
  assert.deepEqual(payload.exercises.map((item) => item.set_type), ["standard", "biset", "drop_set"]);
  assert.equal(payload.exercises[0].load, 20);
  assert.equal(payload.exercises[1].technique_config.components[1].exerciseName, "B");
  assert.equal(payload.exercises[2].technique_config.drop_count, 3);
});

test("instruction video URLs are normalized for persistent playback", () => {
  assert.deepEqual(instructionVideoPayload("https://youtu.be/abc123", "Supino"), {
    title: "Execucao - Supino",
    provider: "youtube",
    url: "https://youtu.be/abc123",
    embed_url: "https://www.youtube.com/embed/abc123",
  });
  assert.deepEqual(instructionVideoPayload("https://www.youtube.com/watch?v=xyz789", "Remada"), {
    title: "Execucao - Remada",
    provider: "youtube",
    url: "https://www.youtube.com/watch?v=xyz789",
    embed_url: "https://www.youtube.com/embed/xyz789",
  });
  assert.equal(instructionVideoPayload("javascript:alert(1)", "Invalido"), null);
  assert.equal(instructionVideoPayload("https://youtube.com/results?search_query=teste", "Busca"), null);
});

test("WorkoutBuilder does not expose a fake video upload or technical URL after save", () => {
  const source = readFileSync(new URL("../src/pages/WorkoutBuilder.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /input type="file" accept="video/);
  assert.doesNotMatch(source, /buildInstructorYoutubeUrl/);
  assert.doesNotMatch(source, /<small[^>]*>\s*\{exercise\.videoUrl\}/);
  assert.match(source, /Abrir vídeo de instrução/);
});
