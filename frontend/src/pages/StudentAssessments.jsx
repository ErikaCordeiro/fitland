import React, { useEffect, useState } from "react";
import { ClipboardCheck, X } from "lucide-react";
import { apiDownload, apiRequest } from "../services/api.js";

const measures = [["weight", "Peso", "kg"], ["height", "Altura", "cm"], ["body_fat_percentage", "Gordura corporal", "%"], ["waist", "Cintura", "cm"], ["abdomen", "Abdômen", "cm"], ["hips", "Quadril", "cm"], ["right_arm", "Braço direito", "cm"], ["left_arm", "Braço esquerdo", "cm"], ["right_thigh", "Coxa direita", "cm"], ["left_thigh", "Coxa esquerda", "cm"]];
const format = (value, unit = "") => value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
const dateLabel = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function StudentPhoto({ assessmentId, photo, onOpen }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let objectUrl = ""; let active = true; apiDownload(`/assessments/${assessmentId}/photos/${photo.id}/view`).then(({ blob }) => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); }).catch(() => {}); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [assessmentId, photo.id]);
  return <button type="button" className="assessment-photo-preview" onClick={() => url && onOpen(url)}>{url ? <img src={url} alt={`${photo.photo_type_label}${photo.description ? `: ${photo.description}` : ""}`}/> : <span>Carregando foto...</span>}</button>;
}

function StudentAssessmentCard({ item }) {
  const [photos, setPhotos] = useState({ loading: true, rows: [] }); const [lightbox, setLightbox] = useState("");
  useEffect(() => { let active = true; apiRequest(`/assessments/${item.id}/photos`).then((rows) => active && setPhotos({ loading: false, rows })).catch(() => active && setPhotos({ loading: false, rows: [] })); return () => { active = false; }; }, [item.id]);
  return <article><header><time>{dateLabel(item.assessment_date)}</time><div>{item.photo_count > 0 && <span>{item.photo_count} {item.photo_count === 1 ? "foto liberada" : "fotos liberadas"}</span>}{item.bmi != null && <span>IMC {format(item.bmi)}</span>}</div></header><div>{measures.filter(([key]) => item[key] != null).map(([key, label, unit]) => <dl key={key}><dt>{label}</dt><dd>{format(item[key], unit)}</dd></dl>)}</div>{item.notes && <p>{item.notes}</p>}<section className="student-assessment-photos" aria-label="Fotos liberadas desta avaliação"><h3>Fotos da avaliação</h3>{photos.loading && <span>Carregando fotos...</span>}{!photos.loading && !photos.rows.length && <span>Nenhuma foto liberada.</span>}<div className="assessment-photo-grid">{photos.rows.map((photo) => <div key={photo.id}><StudentPhoto assessmentId={item.id} photo={photo} onOpen={setLightbox}/><strong>{photo.photo_type_label}</strong>{photo.description && <span>{photo.description}</span>}</div>)}</div></section>{lightbox && <div className="assessment-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox("")}><button aria-label="Fechar"><X/></button><img src={lightbox} alt="Foto da avaliação ampliada" onClick={(event) => event.stopPropagation()}/></div>}</article>;
}

export default function StudentAssessments() {
  const [state, setState] = useState({ status: "loading", rows: [] });
  useEffect(() => { let active = true; apiRequest("/assessments").then((rows) => active && setState({ status: "success", rows })).catch(() => active && setState({ status: "error", rows: [] })); return () => { active = false; }; }, []);
  if (state.status === "loading") return <section className="student-assessments-page"><div className="tenant-data-state" role="status">Carregando avaliações...</div></section>;
  if (state.status === "error") return <section className="student-assessments-page"><div className="tenant-data-state error" role="alert">Não foi possível carregar suas avaliações.</div></section>;
  if (!state.rows.length) return <section className="student-assessments-page"><div className="tenant-data-state"><ClipboardCheck/><strong>Nenhuma avaliação registrada ainda.</strong></div></section>;
  return <section className="student-assessments-page assessments-v2-page"><header className="assessments-v2-header"><div><p className="eyebrow">Minha evolução</p><h2>Avaliações</h2><p>Histórico registrado pelo seu Personal.</p></div></header><div className="student-assessment-list">{state.rows.map((item) => <StudentAssessmentCard key={item.id} item={item}/>)}</div></section>;
}
