import React, { useState } from "react";
import {
  Activity,
  Apple,
  BarChart3,
  Bot,
  CalendarDays,
  Camera,
  Droplets,
  Flame,
  HeartPulse,
  LineChart,
  MessageCircle,
  Ruler,
  Scale,
  Share2,
  Sparkles,
  TrendingDown,
  Trophy
  , X
} from "lucide-react";

const summary = [
  { label: "IMC", value: "25,6", status: "Sobrepeso", delta: "↓ 1,0 desde 20/05", icon: HeartPulse },
  { label: "Gordura corporal", value: "24,3%", status: "Moderado", delta: "↓ 2,1% desde 20/05", icon: TrendingDown },
  { label: "Massa magra", value: "54,1 kg", status: "Adequado", delta: "↑ 1,4 kg desde 20/05", icon: Trophy },
  { label: "Massa gorda", value: "18,3 kg", status: "Moderado", delta: "↓ 1,1 kg desde 20/05", icon: Scale },
  { label: "TMB", value: "1.680 kcal", status: "por dia", delta: "Taxa metabolica basal", icon: Flame },
  { label: "água corporal", value: "39,6 L", status: "Adequado", delta: "↑ 0,8 L desde 20/05", icon: Droplets }
];

const measurements = [
  ["Pescoço", "34,2", "34,6", "↓ 0,4"],
  ["Ombro", "108,5", "109,2", "↓ 0,7"],
  ["Peito", "98,0", "98,7", "↓ 0,7"],
  ["Cintura", "78,2", "81,3", "↓ 3,1"],
  ["Abdômen", "85,4", "88,8", "↓ 3,4"],
  ["Quadril", "102,3", "103,8", "↓ 1,5"],
  ["Braço", "30,5", "30,8", "↓ 0,3"],
  ["Antebraço", "26,1", "26,4", "↓ 0,3"],
  ["Coxa", "56,1", "56,8", "↓ 0,7"],
  ["Panturrilha", "36,2", "36,6", "↓ 0,4"]
];

const skinfolds = [
  ["Peitoral", "12 mm"],
  ["Abdominal", "18 mm"],
  ["Tricipital", "14 mm"],
  ["Subescapular", "13 mm"],
  ["Axilar média", "14 mm"],
  ["Suprailiaca", "16 mm"],
  ["Coxa", "15 mm"]
];

const evolution = [
  ["Peso (kg)", "72,4 kg", "↓ 2,8 kg"],
  ["Gordura corporal (%)", "24,3%", "↓ 2,1%"],
  ["Massa magra (kg)", "54,1 kg", "↑ 1,4 kg"],
  ["IMC", "25,6", "↓ 1,0"],
  ["Medidas (média)", "-2,3 cm", "↓"]
];

const history = [
  ["18/06/2025", "72,4 kg", "24,3%", "25,6", "54,1 kg"],
  ["20/05/2025", "74,1 kg", "25,7%", "26,2", "52,7 kg"],
  ["22/04/2025", "75,3 kg", "27,1%", "26,7", "51,8 kg"],
  ["18/03/2025", "77,8 kg", "28,3%", "27,5", "51,1 kg"],
  ["03/02/2025", "79,2 kg", "29,8%", "28,0", "49,4 kg"]
];

const quickActions = [
  ["Entender minha avaliação", Bot],
  ["Ver evolução completa", LineChart],
  ["Ver plano alimentar", Apple],
  ["Falar com Coach IA", MessageCircle],
  ["Compartilhar evolução", Share2]
];

export default function StudentAssessments({ student, branding }) {
  return <section className="student-assessments-page"><div className="tenant-data-state"><strong>Nenhuma avaliação disponível</strong><span>Suas avaliações aparecerão quando houver registros persistidos.</span></div></section>;
  const name = student?.name || "Erika Gomes";
  const [detailModal, setDetailModal] = useState(null);

  const openDetail = (type, title, value, delta) => {
    setDetailModal({ type, title, value, delta });
  };

  return (
    <section className="student-assessment-page student-assessment-premium">
      <div className="student-assessment-intro">
        <div>
          <p className="eyebrow">Última avaliação</p>
          <h2>Você está evoluindo de verdade, {name.split(" ")[0]}.</h2>
          <span>Acompanhe sua evolução e veja o quanto você esta avançando.</span>
        </div>
        <div className="student-assessment-date">
          <CalendarDays size={20} />
          <span>Última avaliação</span>
          <strong>18/06/2025</strong>
        </div>
      </div>

      <div className="student-assessment-summary">
        {summary.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label}>
              <Icon size={20} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <em>{card.status}</em>
              <small>{card.delta}</small>
            </article>
          );
        })}
      </div>

      <div className="student-assessment-grid">
        <article className="student-assessment-card measures">
          <div className="section-heading">
            <h2>Medidas corporais</h2>
            <span>cm</span>
          </div>
          <div className="student-measure-table">
            <div><span></span><span>Atual</span><span>Anterior</span><span>Evolução</span></div>
            {measurements.map(([label, current, previous, diff]) => (
              <div key={label}>
                <strong>{label}</strong>
                <span>{current}</span>
                <span>{previous}</span>
                <mark>{diff}</mark>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => openDetail("measures", "Medidas corporais", "10 medidas", "Evolução média de -2,3 cm")}>Ver todas as medidas</button>
        </article>

        <article className="student-assessment-card skinfold">
          <div className="section-heading">
            <h2>Dobras cutaneas (adipometro)</h2>
            <span>mm</span>
          </div>
          <div className="student-skinfold-layout">
            <div className="student-body-visual">
              <div className="body-illustration" aria-label="Pontos de medicao com adipometro">
                <span className="head" />
                <span className="torso" />
                <span className="arm left" />
                <span className="arm right" />
                <span className="leg left" />
                <span className="leg right" />
                <i className="point chest" />
                <i className="point abdômen" />
                <i className="point thigh" />
              </div>
              <div className="body-illustration back" aria-hidden="true">
                <span className="head" />
                <span className="torso" />
                <span className="arm left" />
                <span className="arm right" />
                <span className="leg left" />
                <span className="leg right" />
                <i className="point chest" />
                <i className="point abdômen" />
                <i className="point thigh" />
              </div>
            </div>
            <div className="student-skinfold-list">
              {skinfolds.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="student-fat-score">
            <span>Gordura corporal (metodo Jackson-Pollock)</span>
            <strong>24,3%</strong>
            <em>Classificacao: Moderado</em>
          </div>
        </article>
      </div>

      <div className="student-assessment-grid photos-row">
        <article className="student-assessment-card assessment-photos">
          <h2>Fotos da avaliação</h2>
          <div className="student-photo-triptych">
            {["Frontal", "Lateral", "Traseira"].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <img src={student?.avatar || "/erika-gomes.jpeg"} alt={`${label} da avaliação`} />
                <small>18/06/2025</small>
              </div>
            ))}
          </div>
        </article>

        <article className="student-assessment-card compare-card">
          <h2>Comparar com avaliação anterior</h2>
          <div>
            <img src={student?.avatar || "/erika-gomes.jpeg"} alt="Antes" />
            <span>↔</span>
            <img src={student?.avatar || "/erika-gomes.jpeg"} alt="Depois" />
          </div>
          <button type="button" onClick={() => openDetail("photos", "Fotos da avaliação", "3 fotos", "Comparativo frontal, lateral e traseiro")}>Ver todas as fotos</button>
        </article>
      </div>

      <article className="student-assessment-card full-row">
        <h2>Evolução</h2>
        <div className="student-evolution-grid">
          {evolution.map(([label, value, delta]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{delta}</small>
              <svg viewBox="0 0 180 92">
                <polyline points="4,20 42,32 78,38 114,54 150,64 176,76" />
                <circle cx="176" cy="76" r="4" />
              </svg>
              <button type="button" onClick={() => openDetail("evolution", label, value, delta)}>Ver mais</button>
            </div>
          ))}
        </div>
      </article>

      <div className="student-assessment-grid bottom">
        <article className="student-assessment-card history">
          <h2>Histórico de avaliações</h2>
          <table>
            <thead>
              <tr><th>Data</th><th>Peso</th><th>Gordura</th><th>IMC</th><th>Massa magra</th></tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => openDetail("history", "Histórico de avaliações", "5 avaliações", "Última avaliação em 18/06/2025")}>Ver todas as avaliações</button>
        </article>

        <article className="student-assessment-card personal-notes">
          <h2>Observações do seu personal</h2>
          <span>{branding?.display_name || "Seu personal"} - 18/06/2025</span>
          <p>
            Excelente evolução. Redução significativa de gordura corporal e aumento de massa magra.
            Continue mantendo consistência nos treinos e na alimentação. Proximo objetivo: reduzir gordura para abaixo de 20%.
          </p>
          <button type="button" onClick={() => openDetail("notes", "Observações do personal", "Proximo objetivo", "Reduzir gordura corporal para abaixo de 20%")}>Ver todas as observações</button>
        </article>

        <article className="student-assessment-card quick-actions">
          <h2>Ações rápidas</h2>
          {quickActions.map(([label, Icon]) => (
            <button key={label} type="button">
              <Icon size={17} />
              {label}
            </button>
          ))}
          <div className="student-coach-question">
            <Sparkles size={22} />
            <strong>Pergunte ao Coach IA</strong>
            <span>Meu IMC esta bom?</span>
          </div>
        </article>
      </div>

      <div className="student-assessment-quote">
        <Activity size={22} />
        <span>Disciplina hoje, resultado amanhã. Você está no caminho certo.</span>
      </div>

      {detailModal && (
        <div className="assessment-detail-backdrop" role="presentation" onMouseDown={() => setDetailModal(null)}>
          <article className="assessment-detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setDetailModal(null)} aria-label="Fechar">
              <X size={20} />
            </button>
            <p className="eyebrow">Detalhes da avaliação</p>
            <h2>{detailModal.title}</h2>
            <div className="assessment-detail-highlight">
              <strong>{detailModal.value}</strong>
              <span>{detailModal.delta}</span>
            </div>
            <svg viewBox="0 0 320 150" className="assessment-detail-chart" aria-label={`Grafico de ${detailModal.title}`}>
              <line x1="16" y1="122" x2="304" y2="122" />
              <line x1="16" y1="82" x2="304" y2="82" />
              <line x1="16" y1="42" x2="304" y2="42" />
              <polyline points="18,42 72,58 126,68 180,86 238,98 302,112" />
              <circle cx="302" cy="112" r="5" />
            </svg>
            <p>
              Essa evolução compara sua avaliação atual com os registros anteriores. O objetivo é mostrar tendência,
              constancia e onde ajustar treino, dieta e hidratação.
            </p>
            <button className="metal-button inline" type="button" onClick={() => setDetailModal(null)}>Entendi</button>
          </article>
        </div>
      )}
    </section>
  );
}
