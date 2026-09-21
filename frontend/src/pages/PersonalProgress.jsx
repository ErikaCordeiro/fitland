import React, { useEffect, useState } from "react";
import { apiRequest } from "../services/api.js";

export default function PersonalProgress() {
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    apiRequest("/workout-sessions/history")
      .then((records) => {
        if (!active) return;
        setHistory(Array.isArray(records) ? records : []);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => { active = false; };
  }, []);

  if (status === "loading") return <section className="personal-progress-page"><p>Carregando progresso...</p></section>;
  if (status === "error") return <section className="personal-progress-page tenant-data-state error" role="alert"><strong>Não foi possível carregar o progresso</strong><p>Tente novamente em alguns instantes.</p></section>;
  if (!history.length) return <section className="personal-progress-page tenant-data-state"><strong>Nenhum progresso registrado ainda</strong><p>As execuções dos alunos aparecerão aqui depois do primeiro treino finalizado.</p></section>;

  return (
    <section className="personal-progress-page">
      <div className="section-heading"><div><p className="eyebrow">Progresso dos alunos</p><h2>Execuções registradas</h2></div><span className="status-pill">{history.length} registro(s)</span></div>
      <div className="workout-history-list">
        {history.map((session) => {
          const exercises = session.exercises || [];
          const sets = exercises.flatMap((exercise) => exercise.sets || []);
          const completedSets = sets.filter((set) => set.status === "concluida");
          return (
            <article className="premium-panel" key={session.id}>
              <strong>{session.workout_name}</strong>
              <span>{exercises.length} exercício(s) • {completedSets.length}/{sets.length} séries • {session.status === "concluido" ? "Concluído" : "Incompleto"}</span>
              <div className="history-exercise-detail-list">
                {exercises.map((exercise) => {
                  const loads = (exercise.sets || []).map((set) => Number(set.used_load) || 0);
                  return <div key={exercise.exercise_id}><strong>{exercise.exercise_name}</strong><span>Carga máxima {Math.max(0, ...loads)} kg</span></div>;
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
