import { apiRequest, getToken } from "./api.js";
import {
  cacheHistory,
  mergeWorkoutHistory,
  persistWithQueue,
  readJson,
  readPendingWorkouts,
  retryQueue,
  storageOrDefault,
  historyKey,
} from "../utils/workoutSync.js";
export { selectLatestExercisePerformance } from "../utils/workoutSync.js";

function numeric(value) {
  const parsed = Number(String(value ?? "").replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function executionToPayload(execution, workout) {
  return {
    client_session_id: execution.id,
    workout_ref: String(workout.id),
    workout_name: workout.name,
    status: execution.status,
    started_at: execution.startedAt,
    completed_at: execution.completedAt,
    duration_seconds: execution.accumulatedDuration || 0,
    current_exercise_id: execution.currentExerciseId ? String(execution.currentExerciseId) : null,
    progress: { current_set_number: execution.currentSetNumber, rest: execution.rest },
    exercises: execution.exercises.map((exercise) => ({
      exercise_id: String(exercise.exerciseId),
      exercise_name: workout.exercises.find((item) => item.id === exercise.exerciseId)?.name || "Exercício",
      position: exercise.position,
      status: exercise.status,
      sets: exercise.sets.map((set) => ({
        set_number: set.setNumber,
        set_type: set.setType || "standard",
        status: set.status,
        used_load: numeric(set.usedLoad),
        completed_reps: numeric(set.completedReps),
        observation: set.observation || null,
        components: (set.components || []).map((item, index) => ({
          exercise_id: String(item.exerciseId), exercise_name: item.exerciseName, order: item.order ?? index,
          load: numeric(item.load), repetitions: numeric(item.repetitions), completed: Boolean(item.completed)
        })),
        drops: (set.drops || []).map((item, index) => ({ order: item.order ?? index, load: numeric(item.load), repetitions: numeric(item.repetitions), completed: Boolean(item.completed) })),
        started_at: set.startedAt,
        completed_at: set.completedAt
      }))
    })),
    feedback: execution.feedback,
    client_updated_at: execution.updatedAt || new Date().toISOString()
  };
}

export function backendToExecution(session, fallback) {
  if (!session) return fallback;
  return {
    ...fallback,
    id: session.client_session_id,
    status: session.status,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    accumulatedDuration: session.duration_seconds,
    currentExerciseId: session.current_exercise_id,
    currentSetNumber: session.progress?.current_set_number || 1,
    rest: session.progress?.rest || null,
    feedback: session.feedback,
    updatedAt: session.client_updated_at,
    backendId: session.id,
    exercises: session.exercises.map((exercise) => ({
      exerciseId: exercise.exercise_id,
      position: exercise.position,
      status: exercise.status,
      expanded: exercise.status !== "concluido",
      sets: exercise.sets.map((set) => ({
        setNumber: set.set_number, setType: set.set_type, status: set.status,
        usedLoad: set.used_load == null ? "" : String(set.used_load),
        completedReps: set.completed_reps == null ? "" : String(set.completed_reps),
        observation: set.observation || "",
        components: (set.components || []).map((item) => ({ exerciseId: item.exercise_id, exerciseName: item.exercise_name, order: item.order, load: item.load ?? "", repetitions: item.repetitions ?? "", completed: item.completed })),
        drops: (set.drops || []).map((item) => ({ order: item.order, load: item.load ?? "", repetitions: item.repetitions ?? "", completed: item.completed })),
        startedAt: set.started_at, completedAt: set.completed_at
      }))
    }))
  };
}

export const fetchActiveWorkout = (workoutRef) => apiRequest(`/workout-sessions/active?workout_ref=${encodeURIComponent(workoutRef)}`);
export const saveWorkoutSession = (execution, workout) => apiRequest("/workout-sessions/current", { method: "PUT", body: JSON.stringify(executionToPayload(execution, workout)), timeoutMs: 15000 });
export const discardWorkoutSession = (id) => apiRequest(`/workout-sessions/${id}`, { method: "DELETE" });
export const fetchWorkoutHistory = () => apiRequest("/workout-sessions/history");
export const fetchProgressionAlerts = () => apiRequest("/workout-sessions/progression-alerts");
export const fetchLatestExercisePerformance = (exerciseRef) => apiRequest(`/workout-sessions/exercises/${encodeURIComponent(exerciseRef)}/latest`);

export function backendHistoryToLocal(records) {
  return records.map((session) => {
    const exercises = session.exercises.map((exercise) => ({
      exerciseId: exercise.exercise_id,
      name: exercise.exercise_name,
      status: exercise.status,
      sets: exercise.sets.map((set) => ({
        setNumber: set.set_number, setType: set.set_type, status: set.status,
        usedLoad: set.used_load == null ? "" : String(set.used_load), completedReps: set.completed_reps == null ? "" : String(set.completed_reps),
        observation: set.observation, components: set.components || [], drops: set.drops || []
      })),
      maxLoad: Math.max(0, ...exercise.sets.map((set) => Number(set.used_load) || 0))
    }));
    const completedSets = exercises.flatMap((item) => item.sets).filter((set) => set.status === "concluida");
    return {
      id: session.id, executionId: session.client_session_id, workoutId: session.workout_ref, workoutName: session.workout_name, syncStatus: "synced",
      date: session.completed_at, completedAt: session.completed_at, duration: session.duration_seconds,
      durationLabel: `${Math.floor(session.duration_seconds / 60)} min`, status: session.status,
      exercisesDone: exercises.filter((item) => item.status === "concluido").length, exercisesTotal: exercises.length,
      setsDone: completedSets.length, setsTotal: exercises.flatMap((item) => item.sets).length,
      volume: completedSets.reduce((sum, set) => sum + ((Number(set.usedLoad) || 0) * (Number(set.completedReps) || 0)), 0),
      exercises
    };
  });
}

export async function persistFinishedWorkout(execution, workout, record, options = {}) {
  return persistWithQueue({ execution, workout, record, storage: options.storage, scope: options.scope, save: options.save || saveWorkoutSession, toPersistedRecord: (saved) => backendHistoryToLocal([saved])[0] });
}

export async function retryPendingWorkouts(options = {}) {
  const storage = storageOrDefault(options.storage);
  if (!historyKey(options.scope)) return [];
  const token = options.save ? null : getToken();
  const canSend = options.canSend || (() => Boolean(token && getToken() === token));
  const records = await retryQueue({ storage, scope: options.scope, save: options.save || saveWorkoutSession, canSend, toPersistedRecord: (saved) => backendHistoryToLocal([saved])[0] });
  if (records.length) {
    const cached = readJson(storage, historyKey(options.scope)).filter((item) => !records.some((record) => record.executionId === item.executionId));
    cacheHistory(mergeWorkoutHistory([...records, ...cached], readPendingWorkouts(storage, options.scope)), storage, options.scope);
  }
  return records;
}

export async function syncWorkoutHistory(options = {}) {
  const storage = storageOrDefault(options.storage);
  if (!historyKey(options.scope)) return [];
  const token = options.fetchHistory ? null : getToken();
  const retried = await retryPendingWorkouts(options);
  const fetchHistory = options.fetchHistory || fetchWorkoutHistory;
  const records = backendHistoryToLocal(await fetchHistory());
  if (!options.fetchHistory && getToken() !== token) return [];
  return cacheHistory(mergeWorkoutHistory([...records, ...retried], readPendingWorkouts(storage, options.scope)), storage, options.scope);
}
