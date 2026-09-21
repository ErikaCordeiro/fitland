import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeWorkoutHistory,
  persistWithQueue,
  readPendingWorkouts,
  retryQueue,
  selectLatestExercisePerformance,
  historyKey,
  pendingSyncKey,
} from "../src/utils/workoutSync.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const execution = {
  id: "session-stable-1", studentId: "student-row-a", workoutId: "workout-1", status: "concluido", startedAt: "2026-09-10T10:00:00Z",
  completedAt: "2026-09-10T10:30:00Z", accumulatedDuration: 1800, currentExerciseId: "ex-1",
  currentSetNumber: 1, rest: null, feedback: { rating: 5 }, updatedAt: "2026-09-10T10:30:00Z",
  exercises: [{ exerciseId: "ex-1", position: 1, status: "concluido", sets: [{ setNumber: 1, setType: "standard", status: "concluida", usedLoad: "40", completedReps: "10", components: [], drops: [] }] }],
};
const scope = { personalId: "personal-a", userId: "user-a" };
const workout = { id: "workout-1", studentId: "student-row-a", personalId: scope.personalId, name: "Treino A", exercises: [{ id: "ex-1", name: "Agachamento" }] };
const localRecord = { id: "hist-session-stable-1", executionId: execution.id, workoutName: workout.name, status: "concluido", completedAt: execution.completedAt, exercisesDone: 1, exercisesTotal: 1 };

function backendSession(id = "db-1") {
  return {
    id, client_session_id: execution.id, workout_ref: workout.id, workout_name: workout.name,
    status: "concluido", started_at: execution.startedAt, completed_at: execution.completedAt,
    duration_seconds: 1800, exercises: [{ exercise_id: "ex-1", exercise_name: "Agachamento", position: 1, status: "concluido", sets: [{ set_number: 1, set_type: "standard", status: "concluida", used_load: 40, completed_reps: 10, components: [], drops: [] }] }],
  };
}
const toPersistedRecord = (saved) => ({ ...localRecord, id: saved.id, syncStatus: "synced" });

test("finished workout with API success becomes synchronized", async () => {
  const storage = memoryStorage();
  const result = await persistWithQueue({ execution, workout, record: localRecord, storage, scope, save: async () => backendSession(), toPersistedRecord });
  assert.equal(result.syncStatus, "synced");
  assert.equal(readPendingWorkouts(storage, scope).length, 0);
  assert.equal(JSON.parse(storage.getItem(historyKey(scope)))[0].syncStatus, "synced");
});

test("offline finish remains pending and later retry synchronizes", async () => {
  const storage = memoryStorage();
  const offline = await persistWithQueue({ execution, workout, record: localRecord, storage, scope, save: async () => { throw new Error("offline"); }, toPersistedRecord });
  assert.equal(offline.syncStatus, "pending_sync");
  assert.equal(readPendingWorkouts(storage, scope)[0].clientSessionId, execution.id);
  const calls = [];
  await retryQueue({ storage, scope, save: async (item) => { calls.push(item.id); return backendSession(); }, toPersistedRecord });
  assert.deepEqual(calls, [execution.id]);
  assert.equal(readPendingWorkouts(storage, scope).length, 0);
});

test("timeout after persistence retries the same id and server upsert cannot duplicate", async () => {
  const storage = memoryStorage();
  const server = new Map();
  const saveThenTimeout = async (item) => { server.set(item.id, backendSession()); throw new Error("timeout"); };
  await persistWithQueue({ execution, workout, record: localRecord, storage, scope, save: saveThenTimeout, toPersistedRecord });
  await retryQueue({ storage, scope, save: async (item) => { server.set(item.id, backendSession()); return server.get(item.id); }, toPersistedRecord });
  assert.equal(server.size, 1);
  assert.equal(readPendingWorkouts(storage, scope).length, 0);
});

test("backend history wins over the same local pending session", () => {
  const persisted = [{ executionId: execution.id, completedAt: execution.completedAt }];
  const pending = [{ clientSessionId: execution.id, record: { ...localRecord, syncStatus: "pending_sync" } }];
  const merged = mergeWorkoutHistory(persisted, pending);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].syncStatus, "synced");
});

test("synchronized workout remains available after history reload", async () => {
  const storage = memoryStorage();
  await persistWithQueue({ execution, workout, record: localRecord, storage, scope, save: async () => backendSession(), toPersistedRecord });
  assert.equal(JSON.parse(storage.getItem(historyKey(scope))).length, 1);
});

test("newer pending performance is a fallback without replacing persisted identity", () => {
  const persisted = [{ executionId: "older", completedAt: "2026-09-09T10:00:00Z", syncStatus: "synced" }];
  const pending = [{ clientSessionId: "newer", record: { executionId: "newer", completedAt: "2026-09-10T10:00:00Z" } }];
  const merged = mergeWorkoutHistory(persisted, pending);
  assert.deepEqual(merged.map((item) => item.executionId), ["newer", "older"]);
  assert.equal(merged[0].syncStatus, "pending_sync");
});

test("latest load comes from persisted history and a newer pending record is a fallback", () => {
  const persisted = { executionId: "persisted", completedAt: "2026-09-09T10:00:00Z", syncStatus: "synced", exercises: [{ exerciseId: "ex-1", sets: [{ status: "concluida", usedLoad: "40", completedReps: "10" }] }] };
  assert.equal(selectLatestExercisePerformance([persisted], "ex-1").usedLoad, "40");
  const pending = { executionId: "pending", completedAt: "2026-09-10T10:00:00Z", syncStatus: "pending_sync", exercises: [{ exerciseId: "ex-1", sets: [{ status: "concluida", usedLoad: "42.5", completedReps: "9" }] }] };
  const latest = selectLatestExercisePerformance([persisted, pending], "ex-1");
  assert.equal(latest.usedLoad, "42.5");
  assert.equal(latest.syncStatus, "pending_sync");
});
