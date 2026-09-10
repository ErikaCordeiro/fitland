import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckSquare,
  CircleDollarSign,
  ClipboardCheck,
  Dumbbell,
  LineChart,
  MessageSquare,
  MoreHorizontal,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  Utensils,
  X
} from "lucide-react";

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
const chartLines = {
  adherence: "8,72 22,61 38,47 54,43 70,24 92,18",
  workouts: "8,86 22,73 38,70 54,58 70,62 92,38",
  students: "8,94 22,84 38,82 54,74 70,77 92,67"
};

const baseRows = [
  ["Maria Eduarda", "Emagrecimento", "92%", "Hoje", "↓ 3.2 kg", "Em dia"],
  ["João Vitor", "Hipertrofia", "78%", "Ontem", "↑ 2.1 kg", "Em dia"],
  ["Lucas Almeida", "Definição", "85%", "Hoje", "↓ 1.5 kg", "Em dia"],
  ["Camila Santos", "Emagrecimento", "65%", "3 dias atrás", "↓ 2.8 kg", "Atrasado"],
  ["Rafael Lima", "Hipertrofia", "90%", "Hoje", "↑ 3.6 kg", "Em dia"]
];

const agenda = [
  ["08:00", "Consultoria", "Lucas Almeida"],
  ["09:00", "Avaliação física", "Maria Eduarda"],
  ["10:00", "Reunião online", "Novos alunos"],
  ["14:00", "Consulta", "João Vitor"],
  ["15:00", "Avaliação física", "Camila Santos"]
];

const alerts = [
  ["3 alunos não treinam há 5 dias", "Ver alunos", "students"],
  ["2 avaliações vencendo", "Ver avaliações", "assessments"],
  ["1 aluno com pagamento vencido", "Ver financeiro", "finance"]
];

function getInitialTheme() {
  return localStorage.getItem("ptf_theme") || "dark";
}

export default function PersonalDashboard({ students = [], workouts = [], onNavigate, branding }) {
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const firstStudent = students[0];
  const studentCount = students.length || 128;
  const workoutCount = workouts.length || 482;
  const pendingAssessments = Math.max(1, Math.round(studentCount * 0.05));

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("ptf_theme", theme);
  }, [theme]);

  const kpis = useMemo(() => [
    { label: "Alunos ativos", value: String(studentCount), detail: "↑ 12% vs mês anterior", icon: Users, page: "students" },
    { label: "Adesão média", value: "87%", detail: "↑ 8% vs mês anterior", icon: TrendingUp, page: "progress" },
    { label: "Treinos concluídos", value: String(workoutCount), detail: "↑ 15% vs mês anterior", icon: Dumbbell, page: "workout-builder" },
    { label: "Avaliações pendentes", value: String(pendingAssessments), detail: "Ver avaliações", icon: ClipboardCheck, page: "assessments" },
    { label: "Faturamento mensal", value: "R$ 24.870", detail: "↑ 18% vs mês anterior", icon: CircleDollarSign, page: "finance" },
    { label: "Retenção (30 dias)", value: "92%", detail: "↑ 5% vs mês anterior", icon: RefreshCw, page: "progress" }
  ], [pendingAssessments, studentCount, workoutCount]);

  const studentsRows = students.length
    ? students.slice(0, 5).map((student) => [student.name, student.goal || "Performance", `${student.adherence || 87}%`, "Hoje", "Em evolução", student.paymentStatus || "Em dia"])
    : baseRows;

  const openAction = (title, text, page) => setModal({ title, text, page });
  const go = (page) => onNavigate?.(page);

  return (
    <div className="admin-mock-dashboard">
      <div className="dashboard-utility-bar">
        <button className="theme-toggle-button" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </button>
        <button className="ghost-button compact" type="button" onClick={() => go("reports")}><BarChart3 size={17} /> Relatórios</button>
      </div>

      <section className="admin-kpis">
        {kpis.map(({ label, value, detail, icon: Icon, page }) => (
          <button className="admin-kpi-card" key={label} type="button" onClick={() => go(page)}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
            <Icon size={28} />
          </button>
        ))}
      </section>

      <section className="admin-main-grid">
        <article className="admin-panel performance-panel">
          <div className="panel-head">
            <h2>Desempenho geral</h2>
            <button type="button" onClick={() => openAction("Desempenho dos últimos 6 meses", "A visão executiva mostra adesão, treinos concluídos e novos alunos em uma única leitura.", "reports")}>Últimos 6 meses</button>
          </div>
          <div className="admin-line-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Gráfico de desempenho">
              <polyline points={chartLines.adherence} className="line-solid" />
              <polyline points={chartLines.workouts} className="line-dashed" />
              <polyline points={chartLines.students} className="line-dotted" />
              {chartLines.adherence.split(" ").map((point) => {
                const [cx, cy] = point.split(",");
                return <circle key={point} cx={cx} cy={cy} r="1.2" />;
              })}
            </svg>
            <div className="chart-axis">{months.map((month) => <span key={month}>{month}</span>)}</div>
          </div>
          <div className="chart-legend">
            <span><i className="legend-white" />Adesão média</span>
            <span><i className="legend-silver" />Treinos concluídos</span>
            <span><i className="legend-dark" />Novos alunos</span>
          </div>
        </article>

        <article className="admin-panel goals-panel" role="button" tabIndex="0" onClick={() => openAction("Distribuição de objetivos", "Hipertrofia, emagrecimento, definição e performance organizados por volume de alunos.", "students")}>
          <h2>Distribuição de objetivos</h2>
          <div className="donut-total"><strong>{studentCount}</strong><span>Total</span></div>
          <ul>
            <li>Hipertrofia <strong>45%</strong></li>
            <li>Emagrecimento <strong>30%</strong></li>
            <li>Definição <strong>15%</strong></li>
            <li>Performance <strong>10%</strong></li>
          </ul>
        </article>

        <article className="admin-panel agenda-panel">
          <div className="panel-head">
            <h2>Agenda de hoje</h2>
            <button type="button" onClick={() => go("agenda")}>Ver agenda</button>
          </div>
          <div className="agenda-list">
            {agenda.map(([time, title, detail], index) => (
              <button key={`${time}-${title}`} type="button" onClick={() => go("agenda")}>
                <time>{time}</time>
                <img src={firstStudent?.avatar || branding?.icon_url || "/fitland-icon.svg"} alt="" />
                <span><strong>{title}</strong>{detail}</span>
                <i className={index === 0 ? "active" : ""} />
              </button>
            ))}
          </div>
        </article>

        <article className="admin-panel students-panel">
          <div className="panel-head">
            <h2>Alunos recentes</h2>
            <div className="table-actions">
              <button type="button" onClick={() => go("students")}>Buscar aluno...</button>
              <button type="button" onClick={() => go("students")}>Ver todos</button>
            </div>
          </div>
          <div className="admin-table">
            <div className="admin-table-row head">
              <span>Aluno</span><span>Objetivo</span><span>Adesão</span><span>Último treino</span><span>Progresso</span><span>Pagamento</span><span>Ações</span>
            </div>
            {studentsRows.map(([name, objective, adherence, last, progress, payment]) => (
              <div className="admin-table-row" key={name}>
                <span className="student-cell"><img src={firstStudent?.avatar || branding?.icon_url || "/fitland-icon.svg"} alt="" />{name}</span>
                <span>{objective}</span>
                <span>{adherence}</span>
                <span>{last}</span>
                <span>{progress}</span>
                <span className={payment === "Em dia" ? "badge-ok" : "badge-danger"}>{payment}</span>
                <button type="button" aria-label={`Ações de ${name}`} onClick={() => openAction(name, "Abra o perfil completo do aluno para editar dados, treinos, dieta, avaliações e progresso.", "students")}><MoreHorizontal size={17} /></button>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel finance-panel">
          <div className="panel-head">
            <h2>Resumo financeiro</h2>
            <button type="button" onClick={() => go("finance")}>Este mês</button>
          </div>
          <dl>
            <div><dt>Receita</dt><dd>R$ 24.870,00 <span>↑ 18%</span></dd></div>
            <div><dt>Despesas</dt><dd>R$ 5.430,00 <span className="down">↓ 4%</span></dd></div>
            <div><dt>Lucro líquido</dt><dd>R$ 19.440,00 <span>↑ 22%</span></dd></div>
          </dl>
          <button className="metal-button" type="button" onClick={() => go("finance")}>Ver relatório completo <BarChart3 size={18} /></button>
        </article>

        <article className="admin-panel alerts-panel">
          <div className="panel-head">
            <h2>Alertas importantes</h2>
            <button type="button" onClick={() => go("students")}>Ver todos</button>
          </div>
          {alerts.map(([title, detail, page], index) => (
            <button key={title} type="button" className={`alert-row alert-${index}`} onClick={() => go(page)}>
              <AlertTriangle size={18} />
              <span><strong>{title}</strong>{detail}</span>
            </button>
          ))}
        </article>

        <article className="admin-panel quick-actions-panel">
          <h2>Ações rápidas</h2>
          <div>
            {[
              ["Novo aluno", Users, "students"],
              ["Novo treino", CalendarDays, "workout-builder"],
              ["Nova dieta", Utensils, "diet"],
              ["Adicionar avaliação", CheckSquare, "assessments"],
              ["Enviar mensagem", MessageSquare, "chat"],
              ["Gerar relatório", BarChart3, "reports"]
            ].map(([label, Icon, page]) => (
              <button key={label} type="button" onClick={() => go(page)}><Icon size={22} />{label}</button>
            ))}
          </div>
        </article>

        <article className="admin-panel business-panel">
          <h2>Visão geral do negócio</h2>
          <div>
            <button type="button" onClick={() => go("students")}>Novos alunos <strong>18</strong><small>↑ 20%</small></button>
            <button type="button" onClick={() => go("students")}>Cancelamentos <strong>3</strong><small>↓ 25%</small></button>
            <button type="button" onClick={() => go("finance")}>Ticket médio <strong>R$ 194,00</strong><small>↑ 15%</small></button>
            <button type="button" onClick={() => go("reports")}>Satisfação <strong>4,8/5</strong><small>↑ 8%</small></button>
          </div>
        </article>

        <article className="admin-panel coach-ia-panel">
          <div>
            <p className="eyebrow">Coach IA</p>
            <h2>Seu assistente inteligente para gestão de alunos.</h2>
            <button type="button" onClick={() => go("coach")}>Abrir Coach IA</button>
          </div>
          <img src={branding?.logo_url || branding?.icon_url || "/fitland-icon.svg"} alt="" />
        </article>
      </section>

      <section className="admin-feature-strip">
        <button type="button" onClick={() => go("settings")}><ShieldCheck size={36} /><span><strong>Gestão completa</strong>Tenha total controle do seu negócio fitness</span></button>
        <button type="button" onClick={() => go("reports")}><LineChart size={36} /><span><strong>Dados inteligentes</strong>Acompanhe métricas e tome decisões melhores</span></button>
        <button type="button" onClick={() => go("progress")}><Users size={36} /><span><strong>Evolução dos alunos</strong>Veja o progresso e resultados dos seus alunos</span></button>
        <button type="button" onClick={() => go("coach")}><Sparkles size={36} /><span><strong>Coach IA</strong>Assistente para gestão e produtividade</span></button>
      </section>

      {modal && (
        <div className="admin-action-modal-backdrop" role="dialog" aria-modal="true" aria-label={modal.title}>
          <div className="admin-action-modal">
            <button type="button" aria-label="Fechar" onClick={() => setModal(null)}><X size={18} /></button>
            <p className="eyebrow">Ação disponível</p>
            <h3>{modal.title}</h3>
            <p>{modal.text}</p>
            <div>
              <button className="ghost-button" type="button" onClick={() => setModal(null)}>Fechar</button>
              <button className="metal-button inline" type="button" onClick={() => { setModal(null); go(modal.page); }}>Acessar área</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
