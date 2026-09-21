import React from "react";
import { Brain, Link, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import { useMemo, useState } from "react";

const blankExercise = {
  name: "",
  sets: 4,
  reps: "10",
  rest: "60s",
  load: "",
  explanation: "",
  videoUrl: "",
  videoFile: "",
  setType: "standard",
  techniqueConfig: {},
  partnerName: "",
  partnerReps: "10",
  partnerLoad: "",
  dropCount: 3,
  dropLoads: "",
  dropReps: ""
};

const preferredInstructor = "Leandro Twin";

const buildInstructorYoutubeUrl = (exerciseName) => {
  const query = encodeURIComponent(`${preferredInstructor} ${exerciseName} execução correta`);
  return `https://www.youtube.com/results?search_query=${query}`;
};

function techniqueConfigFor(exercise) {
  if (exercise.setType === "biset") {
    return { components: [
      { exerciseName: exercise.name, repetitions: exercise.reps, prescribedLoad: exercise.load },
      { exerciseName: exercise.partnerName, repetitions: exercise.partnerReps, prescribedLoad: exercise.partnerLoad },
    ] };
  }
  if (exercise.setType === "drop_set") {
    const loads = String(exercise.dropLoads || "").split(",").map((value) => value.trim());
    const repetitions = String(exercise.dropReps || "").split(",").map((value) => value.trim());
    return {
      drop_count: Math.max(1, Number(exercise.dropCount) || 1),
      drops: Array.from({ length: Math.max(1, Number(exercise.dropCount) || 1) }, (_, index) => ({
        order: index,
        prescribedLoad: loads[index] || "",
        prescribedRepetitions: repetitions[index] || "",
      })),
    };
  }
  return {};
}

export default function WorkoutBuilder({ students, workouts, availableExercises = [], onOpenExercise, onSaveWorkout }) {
  const [exercises, setExercises] = useState([{ ...blankExercise, id: crypto.randomUUID() }]);
  const [activeSuggestId, setActiveSuggestId] = useState(null);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const workoutHistory = useMemo(
    () => [...workouts].sort((a, b) => a.name.localeCompare(b.name)),
    [workouts]
  );

  const updateExercise = (id, field, value) => {
    setExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, [field]: value } : exercise));
  };

  const applySuggestion = (id, suggestion) => {
    setExercises((current) => current.map((exercise) => {
      if (exercise.id !== id) return exercise;
      return {
        ...exercise,
        exerciseId: suggestion.id,
        name: suggestion.name,
        explanation: suggestion.explanation,
        videoUrl: buildInstructorYoutubeUrl(suggestion.name)
      };
    }));
    setActiveSuggestId(null);
  };

  const addExercise = () => setExercises((current) => [...current, { ...blankExercise, id: crypto.randomUUID() }]);

  const removeExercise = (id) => {
    setExercises((current) => current.length <= 1 ? current : current.filter((exercise) => exercise.id !== id));
    if (activeSuggestId === id) setActiveSuggestId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setSaveError("");
    try {
      await onSaveWorkout({
        id: editingWorkout?.id || null,
        name: form.get("name"),
        studentId: form.get("studentId"),
        status: "active",
        focus: form.get("focus"),
        duration: form.get("duration"),
        date: form.get("date") || "Segunda",
        exercises: exercises.map((exercise) => ({ ...exercise, techniqueConfig: techniqueConfigFor(exercise), done: false }))
      });
      setEditingWorkout(null);
      setExercises([{ ...blankExercise, id: crypto.randomUUID() }]);
    } catch (error) {
      setSaveError(error.message || "Não foi possível salvar o treino.");
    } finally {
      setSaving(false);
    }
  };

  const editWorkout = (workout) => {
    setEditingWorkout(workout);
    setExercises(workout.exercises.map((exercise) => ({
      ...blankExercise,
      ...exercise,
      id: exercise.id || crypto.randomUUID(),
      setType: exercise.setType || exercise.set_type || "standard",
      techniqueConfig: exercise.techniqueConfig || exercise.technique_config || {},
      partnerName: exercise.techniqueConfig?.components?.[1]?.exerciseName || exercise.technique_config?.components?.[1]?.exerciseName || "",
      partnerReps: exercise.techniqueConfig?.components?.[1]?.repetitions || exercise.technique_config?.components?.[1]?.repetitions || "10",
      partnerLoad: exercise.techniqueConfig?.components?.[1]?.prescribedLoad || exercise.technique_config?.components?.[1]?.prescribedLoad || "",
      dropCount: exercise.techniqueConfig?.drop_count || exercise.technique_config?.drop_count || 3,
      dropLoads: (exercise.techniqueConfig?.drops || exercise.technique_config?.drops || []).map((item) => item.prescribedLoad || "").join(", "),
      dropReps: (exercise.techniqueConfig?.drops || exercise.technique_config?.drops || []).map((item) => item.prescribedRepetitions || "").join(", "),
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="workout-layout">
      <form className="form-panel" onSubmit={submit}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{editingWorkout ? "Editando treino" : "Protocolos"}</p>
            <h2>{editingWorkout ? editingWorkout.name : "Criar treino"}</h2>
          </div>
          <button className="metal-button inline" type="submit" disabled={saving}><Save size={18} /> {saving ? "Salvando..." : editingWorkout ? "Salvar edição" : "Salvar treino"}</button>
        </div>
        <div className="form-grid">
          <label><span>Nome do treino</span><input name="name" key={`name-${editingWorkout?.id || "new"}`} defaultValue={editingWorkout?.name || "Novo treino personalizado"} required /></label>
          <label><span>Aluno</span><select name="studentId" key={`student-${editingWorkout?.id || "new"}`} defaultValue={editingWorkout?.studentId || students[0]?.id}>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
          <label><span>Foco</span><input name="focus" key={`focus-${editingWorkout?.id || "new"}`} defaultValue={editingWorkout?.focus || "Força, hipertrofia e cardio"} /></label>
          <label><span>Duração</span><input name="duration" key={`duration-${editingWorkout?.id || "new"}`} defaultValue={editingWorkout?.duration || "60 min"} /></label>
          <label><span>Dia da semana</span><select name="date" key={`date-${editingWorkout?.id || "new"}`} defaultValue={editingWorkout?.date || "Segunda"}>{["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
        </div>
        <div className="exercise-builder">
          {exercises.map((exercise, index) => {
            const suggestions = exercise.name.trim().length > 1
              ? availableExercises
                .filter((item) => `${item.name} ${item.muscle}`.toLowerCase().includes(exercise.name.toLowerCase()))
                .slice(0, 4)
              : [];

            return (
              <article className="exercise-row" key={exercise.id}>
                <div className="exercise-row-title">
                  <strong>Exercício {index + 1}</strong>
                  <div className="exercise-row-title-actions">
                    <span><Brain size={15} /> IA busca exercícios pelo nome digitado</span>
                    <button
                      className="exercise-remove-button"
                      type="button"
                      onClick={() => removeExercise(exercise.id)}
                      disabled={exercises.length <= 1}
                      title={exercises.length <= 1 ? "Mantenha pelo menos um exercício" : "Excluir exercício"}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="form-grid compact">
                  <div className="exercise-search-field">
                    <input
                      placeholder="Nome do exercício"
                      value={exercise.name}
                      onFocus={() => setActiveSuggestId(exercise.id)}
                      onChange={(event) => {
                        updateExercise(exercise.id, "name", event.target.value);
                        setActiveSuggestId(exercise.id);
                      }}
                      required
                    />
                    {activeSuggestId === exercise.id && suggestions.length > 0 && (
                      <div className="exercise-suggestions">
                        {suggestions.map((suggestion) => (
                          <button key={suggestion.name} type="button" onClick={() => applySuggestion(exercise.id, suggestion)}>
                            <strong>{suggestion.name}</strong>
                            <span>{suggestion.muscle_group || suggestion.muscle || "Exercício"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input placeholder="Séries" type="number" value={exercise.sets} onChange={(event) => updateExercise(exercise.id, "sets", Number(event.target.value))} />
                  <input placeholder="Repetições" value={exercise.reps} onChange={(event) => updateExercise(exercise.id, "reps", event.target.value)} />
                  <input placeholder="Descanso" value={exercise.rest} onChange={(event) => updateExercise(exercise.id, "rest", event.target.value)} />
                  <input placeholder="Carga" value={exercise.load} onChange={(event) => updateExercise(exercise.id, "load", event.target.value)} />
                  <label><span>Técnica</span><select value={exercise.setType} onChange={(event) => updateExercise(exercise.id, "setType", event.target.value)}><option value="standard">Standard</option><option value="biset">Biset</option><option value="drop_set">Drop set</option></select></label>
                  {exercise.setType === "biset" && <>
                    <input placeholder="Segundo exercício do biset" value={exercise.partnerName} onChange={(event) => updateExercise(exercise.id, "partnerName", event.target.value)} required />
                    <input placeholder="Repetições do segundo exercício" value={exercise.partnerReps} onChange={(event) => updateExercise(exercise.id, "partnerReps", event.target.value)} />
                    <input placeholder="Carga do segundo exercício" value={exercise.partnerLoad} onChange={(event) => updateExercise(exercise.id, "partnerLoad", event.target.value)} />
                  </>}
                  {exercise.setType === "drop_set" && <>
                    <input aria-label="Quantidade de etapas do drop set" type="number" min="1" max="6" value={exercise.dropCount} onChange={(event) => updateExercise(exercise.id, "dropCount", Number(event.target.value))} />
                    <input placeholder="Cargas por etapa, separadas por vírgula" value={exercise.dropLoads} onChange={(event) => updateExercise(exercise.id, "dropLoads", event.target.value)} />
                    <input placeholder="Repetições por etapa, separadas por vírgula" value={exercise.dropReps} onChange={(event) => updateExercise(exercise.id, "dropReps", event.target.value)} />
                  </>}
                  <label className="vivideo-input">
                    <span><Link size={15} /> Link do YouTube</span>
                    <input placeholder="https://youtube.com/..." value={exercise.videoUrl} onChange={(event) => updateExercise(exercise.id, "videoUrl", event.target.value)} />
                    {exercise.videoUrl && (
                      <a className="recommended-vivideo-link" href={exercise.videoUrl} target="_blank" rel="noreferrer">
                        Vídeo recomendado disponível - {preferredInstructor}
                      </a>
                    )}
                  </label>
                  <label className="vivideo-input">
                    <span><Upload size={15} /> Upload de vídeo</span>
                    <input type="file" accept="video/*" onChange={(event) => updateExercise(exercise.id, "videoFile", event.target.files?.[0]?.name || "")} />
                  </label>
                  <textarea placeholder="Observações e execução" value={exercise.explanation} onChange={(event) => updateExercise(exercise.id, "explanation", event.target.value)} />
                </div>
                {exercise.videoFile && <small className="upload-name">Vídeo selecionado: {exercise.videoFile}</small>}
              </article>
            );
          })}
        </div>
        {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
        <div className="builder-actions">
          <button className="ghost-button" type="button" onClick={addExercise}><Plus size={18} /> Adicionar exercício</button>
          {editingWorkout && (
            <button className="ghost-button" type="button" onClick={() => { setEditingWorkout(null); setExercises([{ ...blankExercise, id: crypto.randomUUID() }]); }}>
              Novo treino
            </button>
          )}
        </div>
      </form>
      <aside className="workout-list">
        <p className="eyebrow">Histórico</p>
        <h2>Histórico de treinos</h2>
        {workoutHistory.map((workout) => (
          <article key={workout.id} className={`workout-card ${editingWorkout?.id === workout.id ? "active-edit" : ""}`}>
            <div className="workout-card-header" onClick={() => editWorkout(workout)} role="button" tabIndex="0">
              <strong>{workout.name}</strong>
              <span>{workout.date || "Treino"} - {workout.focus} - {workout.duration}</span>
              <small>Clique para editar este treino</small>
            </div>
            {workout.exercises.map((exercise) => (
              <button key={exercise.id} type="button" onClick={() => onOpenExercise(exercise)}>
                <Video size={16} /> {exercise.name}
              </button>
            ))}
          </article>
        ))}
      </aside>
    </section>
  );
}




