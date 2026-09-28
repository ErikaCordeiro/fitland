import test from "node:test";
import assert from "node:assert/strict";
import { createTenantDataState, tenantDashboardMetrics, tenantDataError, tenantDataFromResponses } from "../src/utils/tenantData.js";

test("successful empty API responses remain empty", () => {
  const state = tenantDataFromResponses([], []);
  assert.equal(state.status, "success");
  assert.deepEqual(state.students, []);
  assert.deepEqual(state.workouts, []);
});

test("loading and errors never contain fixture data", () => {
  assert.deepEqual(createTenantDataState("loading").students, []);
  assert.deepEqual(tenantDataError("offline").students, []);
  assert.deepEqual(tenantDataError("offline").workouts, []);
});

test("dashboard metrics use only supplied tenant records", () => {
  assert.deepEqual(tenantDashboardMetrics([], []), { students: 0, workouts: 0, hasStudents: false, hasWorkouts: false });
  assert.deepEqual(tenantDashboardMetrics([{ id: "real-student" }], [{ id: "real-workout" }]), { students: 1, workouts: 1, hasStudents: true, hasWorkouts: true });
});

test("switching tenants replaces records instead of retaining the previous tenant", () => {
  const thiago = tenantDataFromResponses([{ id: "erika" }], [{ id: "workout" }]);
  const hugo = tenantDataFromResponses([], []);
  assert.equal(thiago.students.length, 1);
  assert.equal(hugo.students.length, 0);
  assert.equal(hugo.workouts.length, 0);
});

test("real workout exercises are hydrated only from API exercise records", () => {
  const state = tenantDataFromResponses([], [{ id: "w1", student_id: "s1", duration_minutes: 45, exercises: [{ id: "we1", exercise_id: "e1", repetitions: "12", rest_seconds: 60 }] }], [{ id: "e1", name: "Supino real", explanation: "Controle" }]);
  assert.equal(state.workouts[0].studentId, "s1");
  assert.equal(state.workouts[0].duration, "45 min");
  assert.equal(state.workouts[0].exercises[0].name, "Supino real");
});

test("student workout uses the exercise name embedded in the authorized payload", () => {
  const state = tenantDataFromResponses([], [{
    id: "w1", exercises: [{ id: "we1", exercise_id: "e1", name: "Supino real", set_type: "biset", technique_config: { components: [] } }]
  }]);
  assert.equal(state.workouts[0].exercises[0].name, "Supino real");
  assert.equal(state.workouts[0].exercises[0].setType, "biset");
  assert.deepEqual(state.workouts[0].exercises[0].techniqueConfig, { components: [] });
});

test("workout keeps API order and hydrates instruction video variants", () => {
  const state = tenantDataFromResponses([], [{ id: "w1", exercises: [
    { id: "we2", exercise_id: "e2", order_index: 2, name: "Segundo", video_url: "/uploads/exercises/demo.mp4", video_provider: "upload" },
    { id: "we1", exercise_id: "e1", order_index: 1, name: "Primeiro", video_url: "https://youtube.com/embed/demo", video_provider: "youtube" },
    { id: "we3", exercise_id: "e3", order_index: 3, name: "Terceiro" }
  ] }]);
  assert.deepEqual(state.workouts[0].exercises.map((item) => item.name), ["Segundo", "Primeiro", "Terceiro"]);
  assert.equal(state.workouts[0].exercises[0].videoProvider, "upload");
  assert.equal(state.workouts[0].exercises[1].videoProvider, "youtube");
  assert.equal(state.workouts[0].exercises[2].videoUrl, "");
});

test("a failed optional resource can be represented without injecting fallback rows", () => {
  const state = tenantDataFromResponses([{ id: "real-student" }], [], []);
  const partial = { ...state, status: "partial", error: "workouts unavailable" };
  assert.equal(partial.students.length, 1);
  assert.equal(partial.workouts.length, 0);
  assert.equal(partial.status, "partial");
});
