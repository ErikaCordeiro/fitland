import React, { useMemo, useState } from "react";
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

export default function PersonalDashboard({ students = [], workouts = [], dataStatus = "success", dataError = "", onRetry, onNavigate, branding, theme = "dark", setTheme }) {
  const [modal, setModal] = useState(null);
  const firstStudent = students[0];
  const studentCount = students.length;
  const workoutCount = workouts.length;

  const kpis = useMemo(() => [
    { label: "Alunos ativos", value: String(studentCount), detail: studentCount ? "Dados atuais" : "Sem alunos ainda", icon: Users, page: "students" },
    { label: "Adesão média", value: "—", detail: "Sem dados ainda", icon: TrendingUp, page: "progress" },
    { label: "Treinos cadastrados", value: String(workoutCount), detail: workoutCount ? "Dados atuais" : "Sem treinos ainda", icon: Dumbbell, page: "workout-builder" },
    { label: "Avaliações pendentes", value: "0", detail: "Sem dados ainda", icon: ClipboardCheck, page: "assessments" },
    { label: "Faturamento mensal", value: "—", detail: "Sem dados ainda", icon: CircleDollarSign, page: "finance" },
    { label: "Retenção (30 dias)", value: "—", detail: "Sem dados ainda", icon: RefreshCw, page: "progress" }
  ], [studentCount, workoutCount]);

  const studentsRows = students.slice(0, 5).map((student) => [student.name, student.objective || "Nao informado", "—", "—", "Sem dados", "—"]);

  const openAction = (title, text, page) => setModal({ title, text, page });
  const go = (page) => onNavigate?.(page);

  return (
    <div className="admin-mock-dashboard">
      <div className="dashboard-utility-bar">
        <button className="theme-toggle-button" type="button" onClick={() => setTheme?.(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </button>
        <button className="ghost-button compact" type="button" onClick={() => go("reports")}><BarChart3 size={17} /> Relatórios</button>
      </div>

      {dataStatus === "loading" ? <div className="tenant-data-state" role="status"><strong>Carregando dados...</strong><span>Buscando informacoes deste Personal.</span></div> : null}
      {dataStatus === "error" ? <div className="tenant-data-state error" role="alert"><strong>Nao foi possivel carregar o dashboard</strong><span>{dataError || "Tente novamente."}</span><button className="ghost-button inline" type="button" onClick={onRetry}>Tentar novamente</button></div> : null}
      {dataStatus === "partial" ? <div className="tenant-data-warning" role="status">Alguns dados nao puderam ser carregados. As informacoes disponiveis continuam sendo exibidas.</div> : null}

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
          <div className="dashboard-inline-empty">Sem dados de desempenho ainda.</div>
        </article>

        <article className="admin-panel goals-panel" role="button" tabIndex="0" onClick={() => openAction("Distribuição de objetivos", "Hipertrofia, emagrecimento, definição e performance organizados por volume de alunos.", "students")}>
          <h2>Distribuição de objetivos</h2>
          {studentCount > 0 ? <div className="donut-total"><strong>{studentCount}</strong><span>Total</span></div> : null}
          <div className="dashboard-inline-empty">{studentCount ? "Objetivos disponiveis na lista de alunos." : "Nenhum objetivo cadastrado."}</div>
        </article>

        <article className="admin-panel agenda-panel">
          <div className="panel-head">
            <h2>Agenda de hoje</h2>
            <button type="button" onClick={() => go("agenda")}>Ver agenda</button>
          </div>
          <div className="dashboard-inline-empty">Nenhum compromisso cadastrado.</div>
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
            {studentsRows.length === 0 ? <div className="dashboard-inline-empty table-empty">Nenhum aluno cadastrado.</div> : null}
          </div>
        </article>

        <article className="admin-panel finance-panel">
          <div className="panel-head">
            <h2>Resumo financeiro</h2>
            <button type="button" onClick={() => go("finance")}>Este mês</button>
          </div>
          <div className="dashboard-inline-empty">Sem dados financeiros ainda.</div>
          <button className="metal-button" type="button" onClick={() => go("finance")}>Ver relatório completo <BarChart3 size={18} /></button>
        </article>

        <article className="admin-panel alerts-panel">
          <div className="panel-head">
            <h2>Alertas importantes</h2>
            <button type="button" onClick={() => go("students")}>Ver todos</button>
          </div>
          <div className="dashboard-inline-empty">Nenhum alerta no momento.</div>
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
          <div className="dashboard-inline-empty">As metricas aparecerao quando houver dados reais suficientes.</div>
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
