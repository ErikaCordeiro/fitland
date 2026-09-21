export function createTenantDataState(status = "idle", students = [], workouts = [], error = "") {
  return {
    status,
    students: Array.isArray(students) ? students : [],
    workouts: Array.isArray(workouts) ? workouts : [],
    error
  };
}

export function tenantDataFromResponses(students, workouts, exercises = []) {
  const exerciseById = new Map(exercises.map((exercise) => [String(exercise.id), exercise]));
  const normalizedWorkouts = workouts.map((workout) => ({
    ...workout,
    studentId: workout.studentId || workout.student_id,
    personalId: workout.personalId || workout.personal_id,
    duration: workout.duration || (workout.duration_minutes ? `${workout.duration_minutes} min` : ""),
    exercises: (workout.exercises || []).map((item) => {
      const exercise = exerciseById.get(String(item.exercise_id)) || {};
      return {
        ...item,
        name: item.name || item.exercise_name || exercise.name || "Exercicio",
        reps: item.reps || item.repetitions || "",
        rest: item.rest || `${item.rest_seconds || 0}s`,
        load: item.load == null ? "" : String(item.load),
        setType: item.setType || item.set_type || "standard",
        techniqueConfig: item.techniqueConfig || item.technique_config || {},
        exerciseId: item.exerciseId || item.exercise_id,
        explanation: item.explanation || item.exercise_explanation || exercise.explanation || item.notes || ""
      };
    })
  }));
  return createTenantDataState("success", students, normalizedWorkouts);
}

export function tenantDataError(message = "Nao foi possivel carregar os dados.") {
  return createTenantDataState("error", [], [], message);
}

export function tenantDashboardMetrics(students = [], workouts = []) {
  return {
    students: students.length,
    workouts: workouts.length,
    hasStudents: students.length > 0,
    hasWorkouts: workouts.length > 0
  };
}
