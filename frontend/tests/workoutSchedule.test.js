import test from "node:test";
import assert from "node:assert/strict";
import { getRecommendedWorkout, getUnscheduledWorkouts, groupWorkoutsByWeekday } from "../src/utils/workoutSchedule.js";
import { tenantDataFromResponses } from "../src/utils/tenantData.js";

test("assigned workout without a persisted day remains visible as unscheduled", () => {
  const state = tenantDataFromResponses([], [{ id: "w1", name: "Força Superior A", day_of_week: null, exercises: [{ id: "e1" }] }]);
  assert.deepEqual(getUnscheduledWorkouts(state.workouts).map((item) => item.id), ["w1"]);
  assert.equal(Object.values(groupWorkoutsByWeekday(state.workouts)).flat().length, 0);
});

test("persisted workout day is normalized into the correct weekly slot", () => {
  const workouts = [
    { id: "monday", dayOfWeek: "Segunda" },
    { id: "saturday", day_of_week: "Sábado" },
  ];
  const grouped = groupWorkoutsByWeekday(workouts);
  assert.equal(grouped.Segunda[0].id, "monday");
  assert.equal(grouped.Sábado[0].id, "saturday");
  assert.deepEqual(getUnscheduledWorkouts(workouts), []);
});

test("recommendation is based only on a real scheduled day", () => {
  const monday = new Date(2026, 8, 28);
  const scheduled = { id: "scheduled", dayOfWeek: "Segunda" };
  const unscheduled = { id: "unscheduled", dayOfWeek: "" };
  assert.equal(getRecommendedWorkout([unscheduled, scheduled], monday)?.id, "scheduled");
  assert.equal(getRecommendedWorkout([unscheduled], monday), null);
});
