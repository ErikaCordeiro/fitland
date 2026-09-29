import React, { useMemo, useState } from "react";
import { Activity, CalendarDays, Dumbbell, Scale, TrendingUp } from "lucide-react";

const formatDate = (value) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Sem dados";
const formatNumber = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "Sem dados";

function TrendChart({ points, label, unit }) {
  if (!points?.length) return <p className="progress-empty">Ainda não há registros suficientes para este gráfico.</p>;
  const values = points.map((point) => Number(point.value));
  const min = Math.min(...values), max = Math.max(...values), range = Math.max(max - min, 1);
  const coordinates = points.map((point, index) => `${points.length === 1 ? 50 : 4 + (index / (points.length - 1)) * 92},${90 - ((Number(point.value) - min) / range) * 76}`).join(" ");
  return <div className="progress-trend" role="img" aria-label={`${label}: ${points.map((point) => `${formatDate(point.date)}, ${formatNumber(point.value)} ${unit}`).join("; ")}`}><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={coordinates} /></svg><ol>{points.map((point) => <li key={`${point.date}-${point.value}`}><span>{formatDate(point.date)}</span><strong>{formatNumber(point.value)} {unit}</strong></li>)}</ol></div>;
}

export default function ProgressOverview({ data, studentView = false }) {
  const [exerciseId, setExerciseId] = useState(data.exercise_progress[0]?.exercise_id || "");
  const selectedExercise = useMemo(() => data.exercise_progress.find((item) => item.exercise_id === exerciseId) || data.exercise_progress[0], [data.exercise_progress, exerciseId]);
  const cards = [
    ["Treinos concluídos", data.completed_workouts, "no período", TrendingUp],
    ["Semanas ativas", data.active_weeks, "com treino concluído", CalendarDays],
    ["Último treino", formatDate(data.last_workout_at), "conclusão registrada", Activity],
    ["Peso atual", data.current_weight == null ? "Sem dados" : `${formatNumber(data.current_weight)} kg`, data.weight_history.length ? "registro mais recente" : "peso atual do cadastro", Scale],
  ];
  return <div className="progress-overview">
    <header className="progress-overview-heading"><div><p className="eyebrow">{studentView ? "Meu progresso" : "Progresso do aluno"}</p><h2>{data.student_name}</h2></div><span>Últimos {data.period_days} dias</span></header>
    <section className="progress-summary" aria-label="Resumo do progresso">{cards.map(([label, value, note, Icon]) => <article key={label}><Icon size={20}/><small>{label}</small><strong>{value}</strong><span>{note}</span></article>)}</section>
    {!data.completed_workouts && <section className="progress-empty progress-empty-main"><strong>Nenhum treino concluído ainda.</strong><p>Complete seus treinos para acompanhar sua evolução.</p></section>}
    <section className="progress-content-grid">
      <article className="progress-panel"><div className="section-heading"><div><p className="eyebrow">Frequência</p><h3>Treinos concluídos</h3></div><CalendarDays size={21}/></div>{data.workout_frequency.length ? <ul className="progress-frequency">{data.workout_frequency.map((item) => <li key={item.date}><span>{formatDate(item.date)}</span><strong>{item.count} treino(s)</strong></li>)}</ul> : <p className="progress-empty">Nenhum treino concluído no período.</p>}</article>
      <article className="progress-panel progress-load-panel"><div className="section-heading"><div><p className="eyebrow">Evolução de carga</p><h3>Carga executada</h3></div><Dumbbell size={21}/></div>{data.exercise_progress.length ? <><label>Exercício<select value={selectedExercise?.exercise_id || ""} onChange={(event) => setExerciseId(event.target.value)}>{data.exercise_progress.map((item) => <option key={item.exercise_id} value={item.exercise_id}>{item.exercise_name}</option>)}</select></label><p className="progress-best">Melhor carga registrada <strong>{formatNumber(selectedExercise.best_load)} kg</strong></p><TrendChart points={selectedExercise.points} label={`Evolução de ${selectedExercise.exercise_name}`} unit="kg"/></> : <p className="progress-empty">Sem dados de carga executada suficientes.</p>}</article>
      <article className="progress-panel"><div className="section-heading"><div><p className="eyebrow">Peso corporal</p><h3>Histórico registrado</h3></div><Scale size={21}/></div>{data.weight_history.length ? <TrendChart points={data.weight_history} label="Evolução do peso" unit="kg"/> : <p className="progress-empty">Peso ainda não possui histórico registrado.</p>}</article>
      <article className="progress-panel"><div className="section-heading"><div><p className="eyebrow">Medidas corporais</p><h3>Evolução das medidas</h3></div><Activity size={21}/></div><p className="progress-empty">Sem histórico de medidas. O sistema ainda não armazena medições corporais estruturadas.</p></article>
    </section>
    <section className="progress-foot-grid"><article className="progress-panel"><p className="eyebrow">Volume real</p><strong className="progress-feature-value">{data.real_volume == null ? "Não calculável" : `${formatNumber(data.real_volume)} kg`}</strong><p>{data.real_volume == null ? "São necessárias séries concluídas com repetições e carga executada." : "Soma de repetições executadas × carga executada."}</p></article><article className="progress-panel"><p className="eyebrow">Destaques reais</p>{data.highlights.length ? <ul className="progress-highlights">{data.highlights.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="progress-empty">Ainda não há destaques calculáveis.</p>}</article></section>
  </div>;
}
