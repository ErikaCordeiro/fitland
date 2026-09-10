import React from "react";
import {
  AlertTriangle,
  Apple,
  BarChart3,
  Bot,
  CalendarDays,
  Droplets,
  Dumbbell,
  FileText,
  Flame,
  HeartPulse,
  MessageCircle,
  MoreVertical,
  NotebookPen,
  Send,
  Shield,
  Star,
  Trophy,
  UserRound
} from "lucide-react";

const kpis = [
  ["Peso atual", "72,4 kg", "↓ 2,8 kg vs mês anterior"],
  ["Gordura corporal", "24,3%", "↓ 2,1% vs mês anterior"],
  ["Massa magra", "54,1 kg", "↑ 1,4 kg vs mês anterior"],
  ["IMC", "25,6", "↓ 1,0 vs mês anterior"],
  ["água corporal", "39,6 L", "↑ 0,8 L vs mês anterior"],
  ["Aderência geral", "78%", "↑ 6% vs mês anterior"],
  ["Treinos concluidos", "87%", "↑ 12% vs mês anterior"]
];

const tabs = ["Visão geral", "Treinos", "Dietas", "Avaliações", "Evolução visual", "Check-ins", "Anotações", "Chat"];

const measures = [
  ["Cintura", "78,2 cm", "81,1 cm", "-2,9 cm ↓"],
  ["Abdômen", "85,4 cm", "88,7 cm", "-3,3 cm ↓"],
  ["Peito", "98,0 cm", "96,2 cm", "+1,8 cm ↑"],
  ["Quadril", "102,3 cm", "104,1 cm", "-1,8 cm ↓"],
  ["Braço", "30,5 cm", "30,0 cm", "+0,5 cm ↑"],
  ["Coxa", "56,1 cm", "56,9 cm", "-0,8 cm ↓"],
  ["Panturrilha", "36,2 cm", "36,6 cm", "-0,4 cm ↓"]
];

const insights = [
  "Erika esta entre os alunos com maior evolução do mes.",
  "Aderência alimentar aumentou 8% em relação ao mês anterior.",
  "Sugestão: aumentar carga nos exercícios de membros inferiores."
];

const alerts = [
  ["Baixa ingestão proteica", "3 dias abaixo da meta"],
  ["Hidratação abaixo do ideal", "Média dos últimos 3 dias"],
  ["Excelente evolução", "Massa magra aumentando"]
];

export default function PersonalStudentProgress({ student, onBack, branding }) {
  const athlete = student || {};
  const name = athlete.name || "Erika Gomes";

  return (
    <section className="student-performance-page">
      <div className="student-performance-topbar">
        <button type="button" onClick={onBack}>← Voltar para alunos</button>
        <div>
          <button type="button"><FileText size={17} /> Enviar relatório</button>
          <button type="button"><MoreVertical size={17} /> Mais ações</button>
        </div>
      </div>

      <article className="athlete-hero-card">
        <div className="athlete-identity">
          <img src={athlete.avatar || "/erika-gomes.jpeg"} alt={name} />
          <div>
            <h2>{name}</h2>
            <span><UserRound size={15} /> {athlete.age || 28} anos</span>
            <span>Feminino</span>
            <span>{athlete.height || 1.68} m</span>
            <p>Objetivo: {athlete.objective || "Hipertrofia"}</p>
            <mark>Plano Premium</mark>
          </div>
        </div>
        <div className="lion-score-block">
          <span>Score do Leao</span>
          <strong>92<small>/100</small></strong>
          <div><Star size={17} /><Star size={17} /><Star size={17} /><Star size={17} /><Star size={17} /></div>
        </div>
        <div className="hero-lion-medal">
          <img src={branding?.logo_url || branding?.icon_url || "/fitland-icon.svg"} alt="" />
        </div>
        <div className="athlete-training-facts">
          <div><span>Tempo treinando</span><strong>8 meses</strong><small>Desde 03/10/2024</small></div>
          <div><span>Streak</span><strong>18 dias</strong><small>Melhor sequencia: 23 dias</small></div>
        </div>
      </article>

      <nav className="athlete-tabs">
        {tabs.map((tab) => <button type="button" key={tab}>{tab}</button>)}
      </nav>

      <div className="athlete-kpi-grid">
        {kpis.map(([label, value, delta]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{delta}</small>
            <svg viewBox="0 0 120 42"><polyline points="2,30 20,22 38,28 56,18 74,22 92,12 118,10" /></svg>
          </article>
        ))}
      </div>

      <div className="athlete-main-grid">
        <article className="athlete-panel body-evolution">
          <div className="section-heading">
            <div>
              <h2>Evolução corporal</h2>
              <div className="athlete-mini-tabs">
                {["Peso", "Gordura", "Massa magra", "IMC", "Medidas"].map((item) => <button type="button" key={item}>{item}</button>)}
              </div>
            </div>
            <select defaultValue="quarter"><option value="quarter">últimos 3 meses</option></select>
          </div>
          <svg viewBox="0 0 680 330" className="athlete-line-chart">
            {[60, 115, 170, 225, 280].map((y) => <line key={y} x1="50" x2="630" y1={y} y2={y} />)}
            <polyline points="55,75 130,95 205,116 280,154 355,182 430,205 505,226 625,266" />
            <polyline className="previous" points="55,42 130,64 205,76 280,112 355,138 430,154 505,175 625,210" />
            {["21/03", "04/04", "18/04", "02/05", "16/05", "30/05", "13/06"].map((label, index) => (
              <text key={label} x={52 + index * 94} y="315">{label}</text>
            ))}
          </svg>
          <aside className="athlete-chart-result">
            <span>Período atual</span>
            <strong>-2,8 kg</strong>
            <span>Período anterior</span>
            <strong>-0,9 kg</strong>
            <em>-1,9 kg • 211% melhor</em>
          </aside>
        </article>

        <article className="athlete-panel workout-performance">
          <div className="section-heading"><h2>Performance de treino</h2><select defaultValue="month"><option value="month">Este mês</option></select></div>
          <div className="training-kpis">
            <div><span>Treinos concluidos</span><strong>21 / 24</strong><small>87%</small></div>
            <div><span>Frequência semanal</span><strong>5,2</strong><small>Ótimo</small></div>
            <div><span>Volume total</span><strong>18.450 kg</strong><small>↑ 15%</small></div>
          </div>
          <div className="training-details">
            <div>
              <h3>Principais grupos treinados</h3>
              {["Pernas", "Costas", "Peito", "Ombros", "Biceps"].map((group, index) => (
                <span key={group}>{group}<i style={{ width: `${88 - index * 9}%` }} /></span>
              ))}
            </div>
            <div>
              <h3>Recordes pessoais</h3>
              {["Leg Press 120 kg", "Agachamento 80 kg", "Supino Reto 42 kg", "Remada Curvada 50 kg"].map((record) => <span key={record}>{record}</span>)}
            </div>
          </div>
        </article>
      </div>

      <div className="athlete-secondary-grid">
        <article className="athlete-panel diet-overview">
          <h2>Progresso da dieta</h2>
          <div className="athlete-ring"><strong>74%</strong><span>Aderência alimentar</span></div>
          <ul>
            <li><Flame size={18} /> 1.812 kcal <small>Média de calorias</small></li>
            <li><Apple size={18} /> 128 g <small>Média de proteínas</small></li>
            <li><BarChart3 size={18} /> 5,2 refeições <small>Média por dia</small></li>
            <li><Droplets size={18} /> 2,1 L <small>Média de hidratação</small></li>
          </ul>
        </article>

        <article className="athlete-panel hydration-card">
          <h2>Hidratação</h2>
          <strong>2,1 L</strong>
          <span>Meta: 2,5 L</span>
          <div className="water-bars">
            {[72, 58, 64, 52, 68, 48, 82].map((value, index) => <i key={index} style={{ height: `${value}%` }} />)}
          </div>
          <small>78% da meta</small>
        </article>

        <article className="athlete-panel alerts-card">
          <div className="section-heading"><h2>Alertas</h2><button type="button">Ver todos</button></div>
          {alerts.map(([title, detail]) => (
            <div className="athlete-alert" key={title}><AlertTriangle size={18} /><span><strong>{title}</strong><small>{detail}</small></span></div>
          ))}
        </article>
      </div>

      <div className="athlete-tertiary-grid">
        <article className="athlete-panel visual-evolution">
          <div className="section-heading"><h2>Evolução visual</h2><button type="button">Comparar avaliações</button></div>
          <div className="athlete-photo-sets">
            {["Frontal", "Lateral", "Traseira"].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <div><img src={athlete.avatar || "/erika-gomes.jpeg"} alt={`${label} antes`} /><b>›</b><img src={athlete.avatar || "/erika-gomes.jpeg"} alt={`${label} depois`} /></div>
              </div>
            ))}
          </div>
          <div className="visual-results"><strong>-4,2%</strong><span>Gordura corporal</span><strong>+2,1 kg</strong><span>Massa magra</span><strong>-3,3 cm</strong><span>Cintura</span></div>
        </article>

        <article className="athlete-panel measure-table-panel">
          <div className="section-heading"><h2>Evolução das medidas</h2><select defaultValue="month"><option value="month">Este mês</option></select></div>
          {measures.map(([label, current, previous, diff]) => (
            <div className="athlete-measure-row" key={label}><span>{label}</span><strong>{current}</strong><small>{previous}</small><em className={diff.includes("+") ? "up" : ""}>{diff}</em></div>
          ))}
        </article>

        <article className="athlete-panel private-notes">
          <div className="section-heading"><h2>Anotações do personal</h2><button type="button">Ver todas</button></div>
          <span>18/06/2025 • Hoje</span>
          <p>Excelente evolução. Redução significativa de gordura corporal e aumento de massa magra. Manter foco na dieta e treinos de força.</p>
          <strong>Pontos fortes:</strong>
          <ul><li>Alta consistência</li><li>Boa execução dos treinos</li><li>Excelente disciplina alimentar</li></ul>
          <strong>Pontos de atenção:</strong>
          <ul><li>Aumentar ingestão de proteínas</li><li>Melhorar hidratação nos dias de treino</li></ul>
          <button type="button"><NotebookPen size={17} /> Adicionar anotacao</button>
        </article>
      </div>

      <div className="athlete-bottom-grid">
        <article className="athlete-panel athlete-ranking">
          <h2>Ranking do aluno</h2>
          <strong>1º</strong>
          <span>Posicao geral entre todos os alunos</span>
          {["Aderência 92%", "Evolução 90%", "Frequência 95%", "Dieta 88%", "Hidratação 78%", "Avaliações 100%"].map((item) => <div key={item}>{item}<i /></div>)}
          <p>Score geral <b>92/100</b></p>
        </article>

        <article className="athlete-panel student-distribution">
          <h2>Distribuicao dos alunos</h2>
          <div className="distribution-donut" />
          <ul><li>Em evolução <strong>78 (61%)</strong></li><li>Em manutencao <strong>32 (25%)</strong></li><li>Atencao necessaria <strong>10 (8%)</strong></li><li>Sem progresso <strong>8 (6%)</strong></li></ul>
        </article>

        <article className="athlete-panel ai-insights">
          <div className="section-heading"><h2>Insights da IA</h2><button type="button">Ver todos</button></div>
          {insights.map((insight) => <div key={insight}><Bot size={18} /><span>{insight}</span></div>)}
          <button type="button">Fazer pergunta para Coach IA</button>
        </article>
      </div>

      <footer className="athlete-progress-footer">
        <CalendarDays size={18} />
        <span>Última avaliação física: 18/06/2025</span>
        <span>Próxima avaliação: 18/07/2025</span>
        <span>Ultimo check-in: Hoje as 10:30</span>
        <button type="button"><Shield size={17} /> Ver histórico completo</button>
      </footer>
    </section>
  );
}
