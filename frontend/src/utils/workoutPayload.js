function numericValue(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(String(value).replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildWorkoutPayload(workout, exercises) {
  return {
    student_id: workout.studentId,
    name: String(workout.name || "").trim(),
    focus: workout.focus || null,
    duration_minutes: numericValue(workout.duration),
    notes: workout.notes || null,
    exercises: exercises.map((exercise, index) => ({
      exercise_id: exercise.exerciseId,
      order_index: index,
      sets: Math.max(1, Number(exercise.sets) || 1),
      repetitions: String(exercise.reps || "1"),
      rest_seconds: Math.max(0, numericValue(exercise.rest) || 0),
      load: numericValue(exercise.load),
      notes: exercise.explanation || null,
      set_type: exercise.setType || "standard",
      technique_config: exercise.techniqueConfig || {},
    })),
  };
}
