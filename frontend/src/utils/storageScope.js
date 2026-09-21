export function studentScope(personalId, userId) {
  if (!personalId || !userId) return null;
  return { personalId: String(personalId), userId: String(userId) };
}

export function scopedKey(prefix, scope, ...parts) {
  if (!scope?.personalId || !scope?.userId || parts.some((part) => part == null || part === "")) return null;
  return [prefix, scope.personalId, scope.userId, ...parts.map(String)].join(":");
}

export function executionKey(scope, workout) {
  if (!workout?.id || !workout?.studentId || !workout?.personalId) return null;
  if (String(workout.personalId) !== scope?.personalId) return null;
  return scopedKey("ptf_workout_execution_v2", scope, workout.studentId, workout.id);
}

export function pendingStudentsKey(personalId) {
  return personalId ? `ptf_pending_students:${personalId}` : null;
}

export function readPendingStudents(personalId, storage = globalThis.localStorage) {
  const key = pendingStudentsKey(personalId);
  if (!key) return [];
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePendingStudents(personalId, items, storage = globalThis.localStorage) {
  const key = pendingStudentsKey(personalId);
  if (!key) return false;
  storage.setItem(key, JSON.stringify(items));
  return true;
}
