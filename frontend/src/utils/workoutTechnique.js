export function workoutTechniqueDetails(exercise = {}) {
  const type = exercise.setType || exercise.set_type || "standard";
  const config = exercise.techniqueConfig || exercise.technique_config || {};
  if (type === "biset") {
    return {
      type,
      label: "BISET",
      items: Array.isArray(config.components) ? config.components.map((item) => ({
        name: item.exerciseName || item.exercise_name || "Componente",
        repetitions: item.prescribedRepetitions || item.repetitions || "",
        load: item.prescribedLoad || item.load || ""
      })) : []
    };
  }
  if (type === "drop_set") {
    return {
      type,
      label: "DROP SET",
      items: Array.isArray(config.drops) ? config.drops.map((item, index) => ({
        name: index === 0 ? "Carga inicial" : `Drop ${index}`,
        repetitions: item.prescribedRepetitions || item.repetitions || "",
        load: item.prescribedLoad || item.load || ""
      })) : []
    };
  }
  return { type: "standard", label: "STANDARD", items: [] };
}
