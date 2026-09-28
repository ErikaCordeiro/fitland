import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Dumbbell, Flame, Play, Video, X } from "lucide-react";
import { loadWorkoutHistory } from "../utils/activityData.js";
import { syncWorkoutHistory } from "../services/workoutSessions.js";
import { getRecommendedWorkout, getUnscheduledWorkouts, getWeekdayName, groupWorkoutsByWeekday, normalizeScheduleText } from "../utils/workoutSchedule.js";

const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function StudentPortal({ workout, workouts = [], scope, completed, onStartWorkout, onToggleExercise, onNavigate }) {
  const [loads, setLoads] = useState({});
  const availableWorkouts = workouts.length ? workouts : workout ? [workout] : [];
  const recommendedWorkout = getRecommendedWorkout(availableWorkouts, new Date());
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(() => recommendedWorkout?.id || workout?.id || null);
  const selectedWorkout = availableWorkouts.find((item) => item.id === selectedWorkoutId) || recommendedWorkout || availableWorkouts[0];
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);

  useEffect(() => {
    const refreshHistory = () => syncWorkoutHistory({ scope })
      .then(() => setWorkoutHistory(loadWorkoutHistory(scope)))
      .catch(() => setWorkoutHistory(loadWorkoutHistory(scope)));
    refreshHistory();
    window.addEventListener("focus", refreshHistory);
    window.addEventListener("online", refreshHistory);
    window.addEventListener("storage", refreshHistory);
    return () => {
      window.removeEventListener("focus", refreshHistory);
      window.removeEventListener("online", refreshHistory);
      window.removeEventListener("storage", refreshHistory);
    };
  }, [scope?.personalId, scope?.userId]);

  useEffect(() => {
    if (recommendedWorkout?.id) setSelectedWorkoutId(recommendedWorkout.id);
  }, [recommendedWorkout?.id]);

  const workoutsByDay = useMemo(() => groupWorkoutsByWeekday(availableWorkouts), [availableWorkouts]);
  const unscheduledWorkouts = useMemo(() => getUnscheduledWorkouts(availableWorkouts), [availableWorkouts]);
  const todayName = getWeekdayName(new Date());

  const percent = useMemo(() => {
    const persisted = workoutHistory.find((item) => String(item.workoutId) === String(selectedWorkout?.id) && item.status === "concluido");
    if (persisted) return 100;
    const done = selectedWorkout?.exercises?.filter((exercise) => completed.has(exercise.id)).length || 0;
    return selectedWorkout?.exercises?.length ?Math.round((done / selectedWorkout.exercises.length) * 100) : 0;
  }, [selectedWorkout, completed, workoutHistory]);

  if (!selectedWorkout) return <section className="student-training-page"><article className="premium-panel"><h2>Nenhum treino cadastrado</h2><p>Seu personal ainda não configurou sua semana de treinos.</p></article></section>;

  return (
    <section className="student-training-page">
      <article className="training-hero-card">
        <div>
          <p className="eyebrow">{selectedWorkout.id === recommendedWorkout?.id ? "Treino recomendado para hoje" : "Treino selecionado"}</p>
          <h2>{selectedWorkout.name}</h2>
          <span>{selectedWorkout.dayOfWeek || "Sem dia definido"} • {String(selectedWorkout.focus || "Treino personalizado").replaceAll(",", " •")} • {selectedWorkout.duration}</span>
          <div className="training-facts">
            <span><Dumbbell size={17} />{selectedWorkout.exercises.length} exercícios</span>
            <span><Clock size={17} />{selectedWorkout.duration}</span>
          </div>
          <button type="button" onClick={() => onStartWorkout?.(selectedWorkout.id)}>
            Acessar treino <Play size={16} />
          </button>
        </div>
        <div className="training-ring">
          <div className="progress-ring neon-ring" style={{ "--value": `${percent}%` }}>
            <strong>{percent}%</strong>
            <small>concluído</small>
          </div>
        </div>
      </article>

      <article className="full-workout-panel weekly-workout-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agenda semanal</p>
            <h2>Segunda a domingo</h2>
            <span>Os treinos aparecem no dia definido pelo Personal.</span>
          </div>
          <span className="status-pill">{availableWorkouts.length} treinos</span>
        </div>

        <div className="weekly-workout-grid">
          {weekDays.map((day) => {
            const dayWorkouts = workoutsByDay[day] || [];
            return (
              <article className="weekday-card" key={day}>
                <header>
                  <strong>{day}{normalizeScheduleText(day) === normalizeScheduleText(todayName) ? " - Hoje" : ""}</strong>
                  <span>{dayWorkouts.length ?`${dayWorkouts.length} treino(s)` : "Sem treino agendado"}</span>
                </header>
                {dayWorkouts.length ?dayWorkouts.map((item) => (
                  <button
                    key={item.id}
                    className={selectedWorkout.id === item.id ?"active" : ""}
                    type="button"
                    onClick={() => {
                      setSelectedWorkoutId(item.id);
                    }}
                  >
                    <strong>{item.name}</strong>
                    <small>{item.focus}</small>
                    <em>{item.duration}</em>
                  </button>
                )) : <p>Nenhum treino definido para este dia.</p>}
              </article>
            );
          })}
        </div>
        {unscheduledWorkouts.length > 0 && (
          <section className="unscheduled-workouts" aria-labelledby="unscheduled-title">
            <div><p className="eyebrow">Meus treinos</p><h3 id="unscheduled-title">Sem dia definido</h3><span>Disponíveis para acesso, mas ainda não incluídos na agenda semanal.</span></div>
            <div className="unscheduled-workout-list">
              {unscheduledWorkouts.map((item) => (
                <article key={item.id}>
                  <div><strong>{item.name}</strong><span>{item.focus || "Treino personalizado"}</span><small>{item.exercises.length} exercício(s) • {item.duration}</small></div>
                  <button type="button" onClick={() => setSelectedWorkoutId(item.id)}>Ver treino</button>
                </article>
              ))}
            </div>
          </section>
        )}
      </article>

      <article className="workout-history-panel premium-panel">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2>Treinos concluídos</h2>
          </div>
          <span className="status-pill">{workoutHistory.length} {workoutHistory.length === 1 ?"registro" : "registros"}</span>
        </div>
        {workoutHistory.length ?(
          <div className="workout-history-list">
            {workoutHistory.slice(0, 6).map((item) => {
              const safeVolume = Number(item.volume);
              const volumeLabel = Number.isFinite(safeVolume) && safeVolume > 0 && safeVolume < 200000
                ?`${Math.round(safeVolume).toLocaleString("pt-BR")} kg de volume`
                : "Volume em análise";
              const doneExercises = Number(item.exercisesDone) || 0;
              const totalExercises = Number(item.exercisesTotal) || 0;
              const doneSets = Number(item.setsDone) || 0;
              const totalSets = Number(item.setsTotal) || 0;
              const statusLabel = item.status === "concluido" ?"Concluído" : "Incompleto";

              return (
                <article key={item.id}>
                  {item.syncStatus === "pending_sync" && <span className="history-sync-pending">Pendente de sincronização</span>}
                  <button className="history-open-button" type="button" onClick={() => setHistoryDetail(item)} aria-label={`Ver detalhes de ${item.workoutName}`}>
                  <div>
                    <strong>{item.workoutName}</strong>
                    <span>{item.displayDate} • {item.durationLabel} • {statusLabel}</span>
                  </div>
                  <div>
                    <b>{doneExercises}/{totalExercises}</b> exercícios
                    <small>{doneSets}/{totalSets} séries • {volumeLabel}</small>
                  </div>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-history-text">Nenhum treino concluído ainda. Ao finalizar uma execução, ela aparecerá aqui.</p>
        )}
      </article>

      {historyDetail && (
        <div className="modal-backdrop workout-history-detail-backdrop" role="dialog" aria-modal="true">
          <article className="workout-history-detail premium-panel">
            <button className="icon-button modal-close" type="button" onClick={() => setHistoryDetail(null)} aria-label="Fechar"><X size={18} /></button>
            <p className="eyebrow">Diário de treino</p>
            <h2>{historyDetail.workoutName}</h2>
            <span>{historyDetail.displayDate} • {historyDetail.durationLabel} • {historyDetail.status === "concluido" ?"Concluído" : "Incompleto"}</span>
            <div className="history-detail-grid">
              <div><small>Tempo total</small><strong>{historyDetail.durationLabel}</strong></div>
              <div><small>Exercícios</small><strong>{historyDetail.exercisesDone}/{historyDetail.exercisesTotal}</strong></div>
              <div><small>Séries</small><strong>{historyDetail.setsDone}/{historyDetail.setsTotal}</strong></div>
              <div><small>Volume total</small><strong>{Number(historyDetail.volume || 0).toLocaleString("pt-BR")} kg</strong></div>
              <div><small>Maior carga</small><strong>{historyDetail.maxLoad || "-"}</strong></div>
              <div><small>Repetições</small><strong>{historyDetail.repsTotal || 0}</strong></div>
            </div>
            <div className="history-exercise-detail-list">
              {(historyDetail.exercises || []).map((exercise) => (
                <div key={exercise.exerciseId}>
                  <strong>{exercise.name}</strong>
                  <span>{exercise.sets?.filter((set) => set.status === "concluida").length || 0}/{exercise.sets?.length || 0} séries • carga máxima {exercise.maxLoad || "-"}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
