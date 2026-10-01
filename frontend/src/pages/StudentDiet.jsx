import React, { useEffect, useState } from "react";
import { Clock3, Utensils } from "lucide-react";
import { apiRequest } from "../services/api.js";

const amount = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export default function StudentDiet() {
  const [plan, setPlan] = useState(null), [state, setState] = useState("loading"), [error, setError] = useState("");
  const load = async () => { setState("loading"); try { setPlan(await apiRequest("/meal-plans/active")); setState("success"); } catch (e) { setError(e.detail || e.message || "Não foi possível carregar seu plano."); setState("error"); } };
  useEffect(() => { load(); }, []);
  if (state === "loading") return <section className="student-meal-plan"><div className="tenant-data-state">Carregando plano alimentar...</div></section>;
  if (state === "error") return <section className="student-meal-plan"><div className="tenant-data-state"><strong>Falha ao carregar</strong><span>{error}</span><button type="button" onClick={load}>Tentar novamente</button></div></section>;
  if (!plan) return <section className="student-meal-plan"><div className="tenant-data-state"><Utensils size={30} /><strong>Nenhum plano alimentar disponível no momento.</strong><span>Quando seu Personal publicar um plano, ele aparecerá aqui.</span></div></section>;
  return <section className="student-meal-plan"><header><p className="eyebrow">Meu Plano Alimentar</p><h2>{plan.name}</h2><span>Desde {new Date(`${plan.start_date}T12:00:00`).toLocaleDateString("pt-BR")}</span>{plan.notes && <p>{plan.notes}</p>}</header><div className="student-meal-list">{plan.meals.map((m) => <article key={m.id}><div className="student-meal-time"><Clock3 size={18} /><time>{m.time?.slice(0, 5) || "Horário livre"}</time></div><div><h3>{m.name}</h3>{m.notes && <p>{m.notes}</p>}<ul>{m.items.map((i) => <li key={i.id}><strong>{amount(i.quantity)} {i.unit}</strong><span>{i.food_name}</span>{i.notes && <small>{i.notes}</small>}</li>)}</ul></div></article>)}</div></section>;
}
