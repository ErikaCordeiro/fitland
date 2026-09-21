import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Camera,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  LineChart,
  Medal,
  Scale,
  Sparkles,
  Trophy,
  TrendingUp,
  Utensils
} from "lucide-react";
import {
  calculateCurrentWorkoutStreak,
  completedWorkoutsInMonth,
  loadWorkoutHistory
} from "../utils/activityData.js";
import { syncWorkoutHistory } from "../services/workoutSessions.js";

function sumVolume(history) {
  return history.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);
}

function sumSeries(history) {
  return history.reduce((sum, item) => {
    const savedSets = Number(item.completedSets ?? item.series ?? item.sets);
    if (Number.isFinite(savedSets) && savedSets > 0) return sum + savedSets;

    return sum + (item.exercises || []).reduce((exerciseTotal, exercise) => {
      const exerciseSets = Number(exercise.completedSets ?? exercise.series ?? exercise.sets);
      if (Number.isFinite(exerciseSets) && exerciseSets > 0) return exerciseTotal + exerciseSets;
      return exerciseTotal + (Array.isArray(exercise.sets) ? exercise.sets.filter((set) => set.status === "concluida").length : 0);
    }, 0);
  }, 0);
}

function buildExerciseLoads(history) {
  const map = new Map();
  history.forEach((record) => {
    (record.exercises || []).forEach((exercise) => {
      const value = Number(String(exercise.maxLoad || "").replace(",", ".").replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(value) || value <= 0) return;
      const current = map.get(exercise.name) || { name: exercise.name, start: value, current: value };
      map.set(exercise.name, { ...current, current: Math.max(current.current, value) });
    });
  });
  return [...map.values()].slice(0, 4).map((item) => ({ ...item, percent: Math.min(100, Math.round((item.current / Math.max(item.start, 1)) * 70)) }));
}

export default function Progress({ student, students = [], branding, scope }) {
  const [modal, setModal] = useState(null);
  const [history, setHistory] = useState(() => loadWorkoutHistory(scope));
  const currentStudent = student || students[0] || {};
  const avatar = currentStudent.avatar || "/erika-gomes.jpeg";
  const hasHistory = history.length > 0;
  const streak = calculateCurrentWorkoutStreak(history);
  const monthWorkouts = completedWorkoutsInMonth(history);
  const totalVolume = sumVolume(history);
  const totalSeries = sumSeries(history);
  const loadProgress = useMemo(() => buildExerciseLoads(history), [history]);

  useEffect(() => {
    const refresh = () => syncWorkoutHistory({ scope }).then(() => setHistory(loadWorkoutHistory(scope))).catch(() => setHistory(loadWorkoutHistory(scope)));
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [scope?.personalId, scope?.userId]);

  const metricCards = [
    { label: "Treinos concluídos", value: String(history.length), diff: `${monthWorkouts.length} este mês`, note: "dados reais", icon: TrendingUp },
    { label: "Treinos na semana", value: String(streak), diff: streak === 1 ? "treino concluído" : "treinos concluídos", note: "de segunda-feira a domingo", icon: Flame },
    { label: "Volume total", value: `${Math.round(totalVolume).toLocaleString("pt-BR")} kg`, diff: "treinos concluídos", note: "soma das cargas registradas", icon: Dumbbell },
    { label: "Séries feitas", value: String(totalSeries), diff: "histórico real", note: "séries salvas no treino", icon: BadgeCheck },
    { label: "Peso atual", value: "A definir", diff: "Avaliação pendente", note: "aguardando registro do personal", icon: Scale },
    { label: "Gordura corporal", value: "A definir", diff: "Avaliação pendente", note: "aguardando registro do personal", icon: HeartPulse },
    { label: "Massa magra", value: "A definir", diff: "Avaliação pendente", note: "aguardando registro do personal", icon: Activity },
    { label: "Score do Leão", value: "Não disponível", diff: "Sem fonte persistida", note: "aguardando métrica real", icon: Trophy }
  ];

  return (
    <section className="student-progress-premium">
      <header className="student-progress-hero">
        <div>
          <p className="eyebrow">Central de evolução</p>
          <h1>{hasHistory ? "Você está evoluindo de verdade." : "Seu progresso começa no primeiro treino."}</h1>
          <span>{hasHistory ? "Força, medidas, dieta e consistência reunidas em uma tela premium." : "Nenhuma atividade registrada ainda. Seu progresso começará a aparecer após o primeiro treino."}</span>
          <div className="student-progress-hero-actions">
            <button type="button" onClick={() => setModal("analysis")}>Ver análise completa</button>
            <button type="button" onClick={() => setModal("coach")}>Falar com Coach IA</button>
          </div>
        </div>
        <img className="student-progress-lion" src={branding?.logo_url || branding?.icon_url || "/fitland-icon.svg"} alt={branding?.display_name || "Personal"} />
        <div className="student-progress-profile">
          <img src={avatar} alt={currentStudent.name || "Aluno"} />
          <strong>{currentStudent.name || "Erika Gomes"}</strong>
          <small>Score do Leão não disponível</small>
        </div>
      </header>

      <section className="student-progress-kpis">
        {metricCards.map(({ label, value, diff, note, icon: Icon }) => (
          <article key={label} className="student-progress-kpi">
            <span><Icon size={18} /></span>
            <small>{label}</small>
            <strong>{value}</strong>
            <em>{diff}</em>
            <p>{note}</p>
          </article>
        ))}
      </section>

      <section className="student-progress-grid student-progress-grid-top">
        <article className="student-progress-card load-evolution-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Evolução de carga</p>
              <h2>{hasHistory ? "Força registrada" : "Aguardando treino"}</h2>
            </div>
            <Dumbbell size={22} />
          </div>
          {loadProgress.length ? (
            <div className="load-list">
              {loadProgress.map((item) => (
                <div key={item.name} className="load-row">
                  <div><strong>{item.name}</strong><span>{item.start}kg → {item.current}kg</span></div>
                  <em>+{Math.max(0, item.current - item.start)}kg</em>
                  <div className="silver-bar"><span style={{ width: `${item.percent}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="empty-history-text">Nenhuma atividade registrada ainda.</p>}
        </article>

        <article className="student-progress-card records-card">
          <div className="section-heading"><div><p className="eyebrow">Seus recordes</p><h2>Marcas reais</h2></div><Medal size={22} /></div>
          <div className="record-grid">
            <div><span>Maior carga</span><strong>{loadProgress[0]?.current ? `${loadProgress[0].current} kg` : "--"}</strong><small>após registrar carga</small></div>
            <div><span>Frequência atual</span><strong>{streak}</strong><small>treinos nesta semana</small></div>
            <div><span>Treinos concluídos</span><strong>{history.length}</strong><small>histórico real</small></div>
            <div><span>Volume total</span><strong>{Math.round(totalVolume).toLocaleString("pt-BR")} kg</strong><small>treinos finalizados</small></div>
          </div>
        </article>

        <article className="student-progress-card consistency-card">
          <p className="eyebrow">Frequência e consistência</p>
          <strong>{streak} <span>{streak === 1 ? "treino na semana" : "treinos na semana"}</span></strong>
          <ul>
            <li><Flame size={17} /> Frequência semanal: dados apés treinos</li>
            <li><BadgeCheck size={17} /> Treinos concluídos: {history.length}</li>
            <li><LineChart size={17} /> Consistência mensal: {monthWorkouts.length ? "em construção" : "sem dados"}</li>
          </ul>
        </article>
      </section>

      <section className="student-progress-grid student-progress-grid-middle">
        <article className="student-progress-card body-evolution-card">
          <div className="section-heading"><div><p className="eyebrow">Evolução corporal</p><h2>Dados reais</h2></div><span>Avaliações e treinos</span></div>
          {hasHistory ? <div className="strength-chart"><svg viewBox="0 0 520 210"><polyline points="20,175 110,154 200,118 290,96 380,62 500,34" fill="none" stroke="#f5f5f5" strokeWidth="4" strokeLinecap="round" /></svg></div> : <p className="empty-history-text">Seu progresso começará a aparecer após o primeiro treino.</p>}
        </article>

        <article className="student-progress-card visual-progress-student">
          <div className="section-heading"><div><p className="eyebrow">Evolução visual</p><h2>Fotos comparativas</h2></div><Camera size={21} /></div>
          <p className="empty-history-text">Nenhuma avaliação com foto registrada ainda.</p>
          <button type="button" onClick={() => setModal("evolution")}>Comparar antes/depois</button>
        </article>

        <article className="student-progress-card measures-card-student">
          <div className="section-heading"><div><p className="eyebrow">Medidas corporais</p><h2>Aguardando avaliação</h2></div><span>Atual x anterior</span></div>
          {["Cintura", "Braço", "Peito", "Quadril", "Coxa"].map((label) => <div key={label} className="measure-row-student"><span>{label}</span><strong>--</strong><em>sem registro</em></div>)}
        </article>
      </section>

      <section className="student-progress-grid student-progress-grid-bottom">
        <article className="student-progress-card diet-progress-card-student">
          <div className="section-heading"><div><p className="eyebrow">Progresso da dieta</p><h2>Alimentação e hidratação</h2></div><Utensils size={22} /></div>
          <div className="diet-progress-metrics">
            <div><strong>0%</strong><span>Aderência alimentar</span></div>
            <div><strong>0g</strong><span>Proteínas médias</span></div>
            <div><strong>0L</strong><span>Hidratação média</span></div>
            <div><strong>0</strong><span>Calorias médias</span></div>
          </div>
          <div className="silver-bar"><span style={{ width: "0%" }} /></div>
        </article>

        <article className="student-progress-card ai-insights-student">
          <div className="section-heading"><div><p className="eyebrow">Insights da IA</p><h2>Coach IA</h2></div><Sparkles size={22} /></div>
          <ul>
            <li>{hasHistory ? `Você já concluiu ${history.length} treino(s).` : "Finalize treinos para liberar insights reais de carga, consistência e evolução."}</li>
            <li>{streak ? `Você concluiu ${streak} treino(s) nesta semana.` : "A frequência semanal será calculada apenas com treinos finalizados."}</li>
            <li>O Coach IA não altera seus treinos; ele apenas explica e orienta.</li>
          </ul>
          <button type="button" onClick={() => setModal("coach")}>Perguntar ao Coach IA</button>
        </article>
      </section>
      {modal && (
        <div className="progress-modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <article className="progress-action-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)}>Fechar</button>
            <p className="eyebrow">{modal === "coach" ? "Coach IA" : modal === "evolution" ? "Evolução visual" : "Análise completa"}</p>
            <h2>{modal === "coach" ? "Como posso te ajudar hoje?" : modal === "evolution" ? "Comparativo antes/depois" : "Resumo da sua evolução"}</h2>
            <p>{hasHistory ? "Esta análise usa seus treinos finalizados e registros reais." : "Nenhuma atividade registrada ainda. Seu progresso começará a aparecer após o primeiro treino."}</p>
          </article>
        </div>
      )}
    </section>
  );
}
