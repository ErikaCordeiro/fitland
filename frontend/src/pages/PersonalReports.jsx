import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw, Users, Dumbbell, ClipboardCheck, CircleDollarSign } from "lucide-react";
import { apiRequest, getToken } from "../services/api.js";

const PERIODS = [[30, "Últimos 30 dias"], [90, "Últimos 90 dias"], [180, "Últimos 6 meses"], [365, "Últimos 12 meses"]];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (value) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "—";

export default function PersonalReports({ students = [], onOpenStudent }) {
  const [days, setDays] = useState(30);
  const [studentId, setStudentId] = useState("");
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const load = async () => {
    setStatus("loading"); setError("");
    try {
      const query = new URLSearchParams({ days: String(days), ...(studentId ? { student_id: studentId } : {}) });
      setReport(await apiRequest(`/reports/overview?${query}`)); setStatus("ready");
    } catch (reason) { setError(reason.message || "Não foi possível carregar os relatórios."); setStatus("error"); }
  };
  useEffect(() => { load(); }, [days, studentId]);
  const max = useMemo(() => Math.max(1, ...(report?.workout_series || []).map((row) => row.value)), [report]);
  const exportReport = async () => {
    const query = new URLSearchParams({ days: String(days), ...(studentId ? { student_id: studentId } : {}) });
    const response = await fetch(`/api/reports/export.csv?${query}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!response.ok) { setError("Não foi possível exportar o relatório."); return; }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
    link.href = url; link.download = "relatorio-fitland.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="reports-admin-page reports-real-page">
    <header className="reports-admin-header"><div><p className="eyebrow">VISÃO OPERACIONAL</p><h2>Relatórios</h2><p>Indicadores consolidados a partir dos registros reais do período.</p></div><button type="button" className="reports-primary-button" onClick={exportReport} disabled={status !== "ready"}><Download size={18}/> Exportar CSV</button></header>
    <div className="reports-filters"><label>Período<select value={days} onChange={(event) => setDays(Number(event.target.value))}>{PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Aluno<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Todos os alunos</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label></div>
    {status === "loading" && <div className="tenant-data-state"><RefreshCw className="spin"/><strong>Carregando indicadores...</strong></div>}
    {status === "error" && <div className="tenant-data-state error"><strong>Não foi possível carregar</strong><span>{error}</span><button type="button" onClick={load}>Tentar novamente</button></div>}
    {status === "ready" && report && <>
      <div className="reports-kpi-grid">{[["Alunos cadastrados", report.metrics.students_total, Users], ["Novos alunos", report.metrics.new_students, Users], ["Treinos concluídos", report.metrics.completed_workouts, Dumbbell], ["Alunos que treinaram", report.metrics.students_trained, BarChart3], ["Sem treino no período", report.metrics.students_without_training, Dumbbell], ...(report.modules.assessments ? [["Avaliações", report.metrics.assessments_completed, ClipboardCheck]] : [])].map(([label, value, Icon]) => <article className="reports-kpi-card" key={label}><Icon size={20}/><span>{label}</span><strong>{value}</strong></article>)}</div>
      <article className="reports-card reports-workout-chart"><div className="reports-section-title"><h3>Treinos concluídos ao longo do tempo</h3><p>Somente sessões com conclusão registrada.</p></div>{report.metrics.completed_workouts === 0 ? <div className="reports-empty">Nenhum treino concluído neste período.</div> : <div className="reports-real-chart" role="img" aria-label="Treinos concluídos por dia">{report.workout_series.map((point) => <i key={point.date} style={{ height: `${Math.max(4, point.value / max * 100)}%` }} title={`${formatDate(point.date)}: ${point.value}`} />)}</div>}</article>
      <article className="reports-card"><div className="reports-section-title"><h3>Atividade dos alunos</h3><p>Status factual baseado em sessões concluídas.</p></div><div className="reports-activity-list">{report.student_activity.length === 0 ? <div className="reports-empty">Nenhum aluno encontrado.</div> : report.student_activity.map((row) => <button type="button" key={row.student_id} onClick={() => onOpenStudent?.(row.student_id)}><span><strong>{row.name}</strong><small>{row.status === "trained" ? "Treinou no período" : "Sem treino registrado no período"}</small></span><span><b>{row.completed_workouts}</b><small>treinos</small></span><span><b>{formatDate(row.last_workout_at)}</b><small>último treino</small></span><span><b>{formatDate(row.last_assessment_date)}</b><small>última avaliação</small></span></button>)}</div></article>
      {report.modules.finance && <article className="reports-card"><div className="reports-section-title"><h3>Financeiro</h3><p>Recebimentos do período e saldos atuais em aberto.</p></div><div className="reports-finance-grid">{[["Recebido", report.metrics.received], ["Pendente", report.metrics.pending], ["Em atraso", report.metrics.overdue]].map(([label, value]) => <div key={label}><CircleDollarSign size={19}/><span>{label}</span><strong>{brl.format(Number(value || 0))}</strong></div>)}</div></article>}
    </>}
  </section>;
}
