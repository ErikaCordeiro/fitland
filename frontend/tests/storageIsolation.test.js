import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executionKey, pendingStudentsKey, readPendingStudents, savePendingStudents, studentScope } from "../src/utils/storageScope.js";
import { cacheHistory, historyKey, ownsPendingItem, pendingSyncKey, queuePendingWorkout, readPendingWorkouts, retryQueue } from "../src/utils/workoutSync.js";
import { getMonthlyWorkoutGoal, loadCalendarEvents, loadWorkoutHistory, saveCalendarEvent } from "../src/utils/activityData.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

const a = studentScope("personal-a", "user-a");
const b = studentScope("personal-a", "user-b");
const otherTenant = studentScope("personal-b", "user-a");
const workout = { id: "workout-x", studentId: "student-a", personalId: "personal-a" };

test("execution cache is isolated by tenant, authenticated student, student row and workout", () => {
  const storage = memoryStorage();
  const key = executionKey(a, workout);
  storage.setItem(key, "partial execution");
  assert.equal(storage.getItem(executionKey(a, workout)), "partial execution");
  assert.notEqual(executionKey(b, workout), key);
  assert.equal(storage.getItem(executionKey(b, workout)), null);
  assert.equal(executionKey(otherTenant, workout), null);
  assert.equal(storage.getItem(executionKey(a, { ...workout, id: "workout-y" })), null);
  assert.equal(executionKey(null, workout), null);
  storage.setItem("ptf_workout_execution_v2:student-erika:workout-x", "legacy");
  assert.equal(storage.getItem(key), "partial execution");
});

test("queue refuses other students, tenants and unowned legacy items", async () => {
  const storage = memoryStorage();
  const execution = { id: "session-a", studentId: workout.studentId, workoutId: workout.id };
  queuePendingWorkout(execution, workout, { executionId: execution.id }, storage, a);
  assert.equal(readPendingWorkouts(storage, a).length, 1);
  assert.deepEqual(readPendingWorkouts(storage, b), []);
  assert.deepEqual(readPendingWorkouts(storage, otherTenant), []);
  assert.equal(pendingSyncKey(null), null);
  storage.setItem("ptf_workout_pending_sync_v1", JSON.stringify([{ execution, workout }]));
  const sends = [];
  await retryQueue({ storage, scope: b, save: async () => sends.push("b"), toPersistedRecord: () => ({}) });
  await retryQueue({ storage, scope: otherTenant, save: async () => sends.push("tenant"), toPersistedRecord: () => ({}) });
  assert.deepEqual(sends, []);
  const tampered = { ...readPendingWorkouts(storage, a)[0], owner: undefined };
  storage.setItem(pendingSyncKey(a), JSON.stringify([tampered]));
  assert.equal(ownsPendingItem(tampered, a), false);
  await retryQueue({ storage, scope: a, save: async () => sends.push("unowned"), toPersistedRecord: () => ({}) });
  assert.deepEqual(sends, []);
});

test("history cache is scoped and legacy history is ignored", () => {
  const storage = memoryStorage();
  cacheHistory([{ executionId: "a" }], storage, a);
  assert.equal(JSON.parse(storage.getItem(historyKey(a)))[0].executionId, "a");
  assert.equal(storage.getItem(historyKey(b)), null);
  storage.setItem("ptf_workout_history_v2", JSON.stringify([{ executionId: "legacy" }]));
  assert.equal(storage.getItem(historyKey(a)).includes("legacy"), false);
  assert.equal(historyKey(null), null);
  const previousWindow = global.window;
  global.window = { localStorage: storage };
  try {
    assert.deepEqual(loadWorkoutHistory(b), []);
    assert.deepEqual(loadWorkoutHistory(null), []);
    cacheHistory([{ executionId: "a", status: "concluido", exercisesDone: 1, exercisesTotal: 1, date: "2026-09-10T10:00:00Z" }], storage, a);
    assert.equal(loadWorkoutHistory(a)[0].executionId, "a");
  } finally {
    global.window = previousWindow;
  }
});

test("workout UI contains no fabricated calories or fixed student identity", () => {
  const executionSource = readFileSync(new URL("../src/pages/WorkoutExecution.jsx", import.meta.url), "utf8");
  const portalSource = readFileSync(new URL("../src/pages/StudentPortal.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(executionSource, /estimatedCalories|student-erika/);
  assert.doesNotMatch(portalSource, /420 kcal/);
});

test("pending registrations are tenant-scoped and legacy global data is ignored", () => {
  const storage = memoryStorage();
  savePendingStudents("personal-a", [{ id: "student-request-a" }], storage);
  savePendingStudents("personal-b", [{ id: "student-request-b" }], storage);
  storage.setItem("ptf_pending_students", JSON.stringify([{ id: "legacy" }]));
  assert.deepEqual(readPendingStudents("personal-a", storage).map((item) => item.id), ["student-request-a"]);
  assert.deepEqual(readPendingStudents("personal-b", storage).map((item) => item.id), ["student-request-b"]);
  assert.deepEqual(readPendingStudents(null, storage), []);
  assert.equal(savePendingStudents(null, [], storage), false);
  assert.equal(pendingStudentsKey(null), null);
});

test("calendar events and monthly goals do not cross student sessions", () => {
  const storage = memoryStorage();
  const previousWindow = global.window;
  global.window = { localStorage: storage };
  try {
    saveCalendarEvent({ id: "event-a", date: "2026-09-10" }, a);
    storage.setItem("ptf_monthly_workout_goal:personal-a:user-a", "8");
    storage.setItem("ptf_calendar_events_v1", JSON.stringify([{ id: "legacy", date: "2026-09-10" }]));
    assert.equal(loadCalendarEvents(a)[0].id, "event-a");
    assert.deepEqual(loadCalendarEvents(b), []);
    assert.equal(getMonthlyWorkoutGoal(a), 8);
    assert.equal(getMonthlyWorkoutGoal(b), null);
    assert.deepEqual(loadCalendarEvents(null), []);
  } finally {
    global.window = previousWindow;
  }
});
