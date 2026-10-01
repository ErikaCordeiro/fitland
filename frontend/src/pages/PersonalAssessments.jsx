import React, { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiRequest } from "../services/api.js";

const groups = [
  ["Dados gerais", [["weight", "Peso", "kg"], ["height", "Altura", "cm"], ["body_fat_percentage", "Gordura corporal", "%"]]],
  ["Tronco", [["neck", "Pescoço", "cm"], ["shoulders", "Ombros", "cm"], ["chest", "Peitoral/Tórax", "cm"], ["waist", "Cintura", "cm"], ["abdomen", "Abdômen", "cm"], ["hips", "Quadril", "cm"]]],
  ["Membros", [["right_arm", "Braço direito", "cm"], ["left_arm", "Braço esquerdo", "cm"], ["right_thigh", "Coxa direita", "cm"], ["left_thigh", "Coxa esquerda", "cm"], ["right_calf", "Panturrilha direita", "cm"], ["left_calf", "Panturrilha esquerda", "cm"]]],
];
const fields = groups.flatMap(([, values]) => values);
const emptyForm = { assessment_date: new Date().toISOString().slice(0, 10), notes: "" };
const numberValue = (value) => value === "" || value == null ? null : Number(String(value).replace(",", "."));
const format = (value, unit = "") => value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
const dateLabel = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function AssessmentDialog({ mode, item, studentId, onClose, onSaved }) {
  const [form, setForm] = useState(() => item ? { ...item } : { ...emptyForm, student_id: studentId });
  const [error, setError] = useState("");
  const save = async (event) => {
    event.preventDefault(); setError("");
    const payload = { assessment_date: form.assessment_date, notes: form.notes || null };
    fields.forEach(([key]) => { payload[key] = numberValue(form[key]); });
    if (!item) payload.student_id = studentId;
    try {
      await apiRequest(item ? `/assessments/${item.id}` : "/assessments", { method: item ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (requestError) { setError(requestError.message); }
  };
  if (mode === "detail") return <div className="assessment-modal-backdrop"><article className="assessment-modal" role="dialog" aria-modal="true"><button className="assessment-close" onClick={onClose} aria-label="Fechar"><X /></button><p className="eyebrow">Avaliação de {dateLabel(item.assessment_date)}</p><h2>Medidas registradas</h2>{item.previous ? <p>Comparação com {dateLabel(item.previous.assessment_date)}</p> : <p>Primeira avaliação registrada.</p>}<div className="assessment-comparison">{fields.filter(([key]) => item[key] != null).map(([key, label, unit]) => <div key={key}><span>{label}</span><strong>{format(item[key], unit)}</strong>{item.differences?.[key] != null && <small>Diferença: {item.differences[key] > 0 ? "+" : ""}{format(item.differences[key], unit)}</small>}</div>)}</div>{item.bmi != null && <p><strong>IMC:</strong> {format(item.bmi)}</p>}{item.notes && <p>{item.notes}</p>}</article></div>;
  return <div className="assessment-modal-backdrop"><article className="assessment-modal assessment-form-modal" role="dialog" aria-modal="true"><button className="assessment-close" onClick={onClose} aria-label="Fechar"><X /></button><h2>{item ? "Editar avaliação" : "Nova avaliação"}</h2><form onSubmit={save}><label>Data da avaliação *<input type="date" required value={form.assessment_date} onChange={(e) => setForm({ ...form, assessment_date: e.target.value })}/></label>{groups.map(([title, values]) => <fieldset key={title}><legend>{title}</legend><div className="assessment-input-grid">{values.map(([key, label, unit]) => <label key={key}>{label} ({unit})<input inputMode="decimal" value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}/></label>)}</div></fieldset>)}<label>Observações<textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label>{error && <p className="assessment-error" role="alert">{error}</p>}<button className="assessment-primary" type="submit">Salvar avaliação</button></form></article></div>;
}

export default function PersonalAssessments({ students = [] }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [state, setState] = useState({ status: "loading", rows: [] });
  const [dialog, setDialog] = useState(null);
  const selected = useMemo(() => students.find((student) => student.id === studentId), [students, studentId]);
  const load = async () => {
    if (!studentId) return setState({ status: "empty", rows: [] });
    setState({ status: "loading", rows: [] });
    try { setState({ status: "success", rows: await apiRequest(`/assessments?student_id=${studentId}`) }); }
    catch { setState({ status: "error", rows: [] }); }
  };
  useEffect(() => { if (!studentId && students[0]?.id) setStudentId(students[0].id); }, [students, studentId]);
  useEffect(() => { load(); }, [studentId]);
  const openDetail = async (item) => { try { setDialog({ mode: "detail", item: await apiRequest(`/assessments/${item.id}`) }); } catch { setState((current) => ({ ...current, status: "error" })); } };
  const remove = async (item) => { if (!window.confirm("Excluir somente esta avaliação?")) return; await apiRequest(`/assessments/${item.id}`, { method: "DELETE" }); load(); };
  return <section className="assessments-v2-page"><header className="assessments-v2-header"><div><p className="eyebrow">Histórico físico</p><h2>Avaliações</h2><p>Registros periódicos reais, sem sobrescrever avaliações anteriores.</p></div><button className="assessment-primary" disabled={!studentId} onClick={() => setDialog({ mode: "form", item: null })}><Plus size={18}/> Nova avaliação</button></header><div className="assessment-toolbar"><label>Aluno<select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Selecionar aluno</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>{selected && <span>{selected.objective}</span>}</div>{state.status === "loading" && <div className="tenant-data-state" role="status">Carregando avaliações...</div>}{state.status === "error" && <div className="tenant-data-state error" role="alert">Não foi possível carregar as avaliações.</div>}{state.status !== "loading" && state.status !== "error" && !state.rows.length && <div className="tenant-data-state"><ClipboardCheck/><strong>Nenhuma avaliação registrada ainda.</strong></div>}<div className="assessment-history-list">{state.rows.map((item) => <article key={item.id}><div><time>{dateLabel(item.assessment_date)}</time><strong>{format(item.weight, "kg")}</strong><span>{item.bmi == null ? "IMC não disponível" : `IMC ${format(item.bmi)}`}</span></div><div className="assessment-row-actions"><button onClick={() => openDetail(item)} title="Visualizar"><Eye/></button><button onClick={() => setDialog({ mode: "form", item })} title="Editar"><Pencil/></button><button onClick={() => remove(item)} title="Excluir"><Trash2/></button></div></article>)}</div>{dialog && <AssessmentDialog {...dialog} studentId={studentId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }}/>}</section>;
}
