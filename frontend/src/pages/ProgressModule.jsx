import React, { useEffect, useState } from "react";
import ProgressOverview from "../components/ProgressOverview.jsx";
import { apiRequest } from "../services/api.js";

function PeriodSelect({ value, onChange }) {
  return <label>Período<select value={value} onChange={(event) => onChange(Number(event.target.value))}><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">6 meses</option><option value="365">12 meses</option></select></label>;
}

function Result({ state, studentView = false }) {
  if (state.status === "loading") return <div className="tenant-data-state" role="status">Carregando progresso...</div>;
  if (state.status === "empty") return <div className="tenant-data-state"><strong>Nenhum aluno disponível.</strong><p>Cadastre um aluno para acompanhar a evolução.</p></div>;
  if (state.status === "error") return <div className="tenant-data-state error" role="alert"><strong>Não foi possível carregar o progresso.</strong><p>Tente novamente em alguns instantes.</p></div>;
  return <ProgressOverview data={state.data} studentView={studentView} />;
}

export function StudentProgress() {
  const [period, setPeriod] = useState(90);
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let active = true;
    setState({ status: "loading", data: null });
    apiRequest(`/progress/overview?period_days=${period}`).then((data) => { if (active) setState({ status: "success", data }); }).catch(() => { if (active) setState({ status: "error", data: null }); });
    return () => { active = false; };
  }, [period]);
  return <section className="student-progress-premium progress-module-page"><div className="progress-controls"><PeriodSelect value={period} onChange={setPeriod}/></div><Result state={state} studentView /></section>;
}

export function PersonalProgressModule({ students = [], initialStudentId = null }) {
  const [studentId, setStudentId] = useState(initialStudentId || students[0]?.id || "");
  const [period, setPeriod] = useState(90);
  const [state, setState] = useState({ status: studentId ? "loading" : "empty", data: null });
  useEffect(() => { if (!studentId && students[0]?.id) setStudentId(students[0].id); }, [students, studentId]);
  useEffect(() => {
    if (!studentId) { setState({ status: "empty", data: null }); return undefined; }
    let active = true;
    setState({ status: "loading", data: null });
    apiRequest(`/progress/overview/${studentId}?period_days=${period}`).then((data) => { if (active) setState({ status: "success", data }); }).catch(() => { if (active) setState({ status: "error", data: null }); });
    return () => { active = false; };
  }, [studentId, period]);
  return <section className="personal-progress-page progress-module-page"><div className="progress-controls"><label>Aluno<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Selecionar aluno</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><PeriodSelect value={period} onChange={setPeriod}/></div><Result state={state}/></section>;
}
