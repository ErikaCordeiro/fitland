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
    day_of_week: workout.dayOfWeek || workout.day_of_week || null,
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

export function instructionVideoPayload(videoUrl, exerciseName = "Exercicio") {
  if (!videoUrl) return null;
  let parsed;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  let embedUrl = parsed.toString();
  let provider = "external";
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (!id) return null;
    embedUrl = `https://www.youtube.com/embed/${id}`;
    provider = "youtube";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    const id = parsed.pathname.startsWith("/embed/")
      ? parsed.pathname.split("/").filter(Boolean)[1]
      : parsed.searchParams.get("v");
    if (!id) return null;
    embedUrl = `https://www.youtube.com/embed/${id}`;
    provider = "youtube";
  }
  return {
    title: `Execucao - ${String(exerciseName).trim() || "Exercicio"}`,
    provider,
    url: parsed.toString(),
    embed_url: embedUrl,
  };
}
