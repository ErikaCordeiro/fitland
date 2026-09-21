import { scopedKey } from "./storageScope.js";

export const WORKOUT_HISTORY_KEY = "ptf_workout_history_v2";
export const WORKOUT_PENDING_SYNC_KEY = "ptf_workout_pending_sync_v1";

export const historyKey = (scope) => scopedKey(WORKOUT_HISTORY_KEY, scope);
export const pendingSyncKey = (scope) => scopedKey(WORKOUT_PENDING_SYNC_KEY, scope);

export function storageOrDefault(storage) {
  return storage || (typeof window !== "undefined" ? window.localStorage : null);
}

export function readJson(storage, key) {
  try { return JSON.parse(storage?.getItem(key) || "[]"); } catch { return []; }
}

export function readPendingWorkouts(storage = null, scope = null) {
  const key = pendingSyncKey(scope);
  return key ? readJson(storageOrDefault(storage), key).filter((item) => ownsPendingItem(item, scope)) : [];
}

export function writePendingWorkouts(items, storage = null, scope = null) {
  const key = pendingSyncKey(scope);
  if (!key) return;
  storageOrDefault(storage)?.setItem(key, JSON.stringify(items.filter((item) => ownsPendingItem(item, scope))));
}

export function ownsPendingItem(item, scope) {
  return Boolean(scope?.personalId && scope?.userId && item?.owner?.personalId === scope.personalId &&
    item?.owner?.userId === scope.userId && item?.workout?.personalId === scope.personalId &&
    item?.workout?.studentId && String(item.workout.studentId) === String(item.execution?.studentId) &&
    item?.workout?.id && String(item.workout.id) === String(item.execution?.workoutId));
}

export function queuePendingWorkout(execution, workout, record, storage = null, scope = null) {
  if (!scope?.personalId || !scope?.userId || String(workout?.personalId) !== scope.personalId ||
      String(workout?.studentId) !== String(execution?.studentId) || String(workout?.id) !== String(execution?.workoutId)) return null;
  const target = storageOrDefault(storage);
  const pending = readPendingWorkouts(target, scope).filter((item) => item.clientSessionId !== execution.id);
  const item = { owner: { ...scope }, clientSessionId: execution.id, execution, workout, record: { ...record, syncStatus: "pending_sync" }, queuedAt: new Date().toISOString() };
  writePendingWorkouts([item, ...pending], target, scope);
  return item.record;
}

export function removePendingWorkout(clientSessionId, storage = null, scope = null) {
  const target = storageOrDefault(storage);
  writePendingWorkouts(readPendingWorkouts(target, scope).filter((item) => item.clientSessionId !== clientSessionId), target, scope);
}

export function mergeWorkoutHistory(persisted = [], pendingItems = []) {
  const bySession = new Map();
  persisted.forEach((record) => bySession.set(record.executionId, { ...record, syncStatus: "synced" }));
  pendingItems.forEach((item) => {
    if (!bySession.has(item.clientSessionId)) bySession.set(item.clientSessionId, { ...item.record, syncStatus: "pending_sync" });
  });
  return [...bySession.values()].sort((a, b) => new Date(b.completedAt || b.date || 0) - new Date(a.completedAt || a.date || 0));
}

export function selectLatestExercisePerformance(history, exerciseId) {
  const ordered = [...history].sort((a, b) => new Date(b.completedAt || b.date || 0) - new Date(a.completedAt || a.date || 0));
  for (const record of ordered) {
    const exercise = (record.exercises || []).find((item) => String(item.exerciseId) === String(exerciseId));
    const set = [...(exercise?.sets || [])].reverse().find((item) => item.status === "concluida");
    if (set) return { usedLoad: set.usedLoad || "", completedReps: set.completedReps || "", syncStatus: record.syncStatus || "synced" };
  }
  return null;
}

export function cacheHistory(records, storage = null, scope = null) {
  const key = historyKey(scope);
  if (key) storageOrDefault(storage)?.setItem(key, JSON.stringify(records));
  return records;
}

export async function persistWithQueue({ execution, workout, record, storage, scope, save, toPersistedRecord }) {
  const target = storageOrDefault(storage);
  const pendingRecord = queuePendingWorkout(execution, workout, record, target, scope);
  if (!pendingRecord) return { syncStatus: "not_saved", record: null, error: new Error("Missing workout identity") };
  cacheHistory(mergeWorkoutHistory(readJson(target, historyKey(scope)).filter((item) => item.syncStatus !== "pending_sync"), readPendingWorkouts(target, scope)), target, scope);
  try {
    const saved = await save(execution, workout);
    removePendingWorkout(execution.id, target, scope);
    const persistedRecord = toPersistedRecord(saved);
    const cached = readJson(target, historyKey(scope)).filter((item) => item.executionId !== execution.id && item.syncStatus !== "pending_sync");
    cacheHistory(mergeWorkoutHistory([persistedRecord, ...cached], readPendingWorkouts(target, scope)), target, scope);
    return { syncStatus: "synced", record: persistedRecord };
  } catch (error) {
    return { syncStatus: "pending_sync", record: pendingRecord, error };
  }
}

export async function retryQueue({ storage, scope, save, toPersistedRecord, canSend = () => true }) {
  const target = storageOrDefault(storage);
  const results = [];
  for (const item of readPendingWorkouts(target, scope)) {
    if (!canSend()) break;
    if (!ownsPendingItem(item, scope)) continue;
    try {
      const saved = await save(item.execution, item.workout);
      removePendingWorkout(item.clientSessionId, target, scope);
      results.push(toPersistedRecord(saved));
    } catch {
      // Keep the same client session id queued for the next idempotent retry.
    }
  }
  return results;
}
