import React, { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { apiRequest } from "../services/api.js";

const measures = [["weight", "Peso", "kg"], ["height", "Altura", "cm"], ["body_fat_percentage", "Gordura corporal", "%"], ["waist", "Cintura", "cm"], ["abdomen", "Abdômen", "cm"], ["hips", "Quadril", "cm"], ["right_arm", "Braço direito", "cm"], ["left_arm", "Braço esquerdo", "cm"], ["right_thigh", "Coxa direita", "cm"], ["left_thigh", "Coxa esquerda", "cm"]];
const format = (value, unit = "") => value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
const dateLabel = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export default function StudentAssessments() {
  const [state, setState] = useState({ status: "loading", rows: [] });
  useEffect(() => { let active = true; apiRequest("/assessments").then((rows) => active && setState({ status: "success", rows })).catch(() => active && setState({ status: "error", rows: [] })); return () => { active = false; }; }, []);
  if (state.status === "loading") return <section className="student-assessments-page"><div className="tenant-data-state" role="status">Carregando avaliações...</div></section>;
  if (state.status === "error") return <section className="student-assessments-page"><div className="tenant-data-state error" role="alert">Não foi possível carregar suas avaliações.</div></section>;
  if (!state.rows.length) return <section className="student-assessments-page"><div className="tenant-data-state"><ClipboardCheck/><strong>Nenhuma avaliação registrada ainda.</strong></div></section>;
  return <section className="student-assessments-page assessments-v2-page"><header className="assessments-v2-header"><div><p className="eyebrow">Minha evolução</p><h2>Avaliações</h2><p>Histórico registrado pelo seu Personal.</p></div></header><div className="student-assessment-list">{state.rows.map((item) => <article key={item.id}><header><time>{dateLabel(item.assessment_date)}</time>{item.bmi != null && <span>IMC {format(item.bmi)}</span>}</header><div>{measures.filter(([key]) => item[key] != null).map(([key, label, unit]) => <dl key={key}><dt>{label}</dt><dd>{format(item[key], unit)}</dd></dl>)}</div>{item.notes && <p>{item.notes}</p>}</article>)}</div></section>;
}
