import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, ChevronRight, CircleOff, ClipboardList,
  Dumbbell, GraduationCap, HardDrive, HelpCircle, Plus, Search, Settings,
  Users,
} from "lucide-react";
import { apiRequest } from "../services/api.js";

const statusLabel = { active: "Ativo", suspended: "Suspenso", blocked: "Bloqueado" };

function Avatar({ person }) {
  if (person.avatar_url) return <img className="owner-avatar" src={person.avatar_url} alt="" />;
  const initials = person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  return <span className="owner-avatar initials">{initials}</span>;
}

export default function OwnerDashboard({ onNavigate, theme, setTheme }) {
  const [summary, setSummary] = useState({ personals_active: 0, personals_suspended: 0, personals_blocked: 0, students_total: 0, alerts: [] });
  const [personals, setPersonals] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest("/owner/dashboard/summary"),
      apiRequest("/owner/personals?page=1&size=5&sort=created_at&order=desc"),
    ]).then(([dashboard, list]) => {
      setSummary(dashboard);
      setPersonals(list.items || []);
    }).catch(() => setError("Não foi possível carregar o dashboard."));
  }, []);

  const workouts = useMemo(() => personals.reduce((total, item) => total + (item.workout_count || 0), 0), [personals]);
  const pending = summary.personals_suspended + summary.personals_blocked;
  const cards = [
    ["Personais ativos", summary.personals_active, Users, "Base atual", "up"],
    ["Personais suspensos", summary.personals_suspended, CircleOff, "Acompanhar contas", "warning"],
    ["Alunos totais", summary.students_total, GraduationCap, "Base atual", "up"],
    ["Treinos realizados", workouts, Dumbbell, "Dados dos personais", "up"],
    ["Uso de armazenamento", "—", HardDrive, "Sem dados disponíveis", "neutral"],
    ["Pendências", pending, ClipboardList, "Ver detalhes", "danger"],
  ];
  const alerts = summary.alerts || [];

  return <div className="owner-dashboard">
    <header className="owner-dashboard-topbar">
      <div><h1>Dashboard</h1><p>Visão geral da plataforma Fitland</p></div>
      <div className="owner-dashboard-actions">
        <span className="owner-date-range">Dados atuais</span>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">◐</button>
        <button className="owner-notification" aria-label="Notificações"><Bell/></button>
        <button><HelpCircle/><span>Ajuda</span></button>
      </div>
    </header>
    {error && <p className="owner-alert error">{error}</p>}

    <section className="owner-kpis owner-kpis-six">
      {cards.map(([label, value, Icon, note, tone]) => <button key={label} onClick={() => (label.includes("Personal") || label === "Pendências") && onNavigate("personals")}>
        <span className="owner-kpi-icon"><Icon/></span><span>{label}</span><strong>{value}</strong><small className={tone}>{note}</small><i className="owner-kpi-spark" />
      </button>)}
    </section>

    <section className="owner-overview-grid">
      <article className="owner-panel owner-activity-chart">
        <div className="owner-panel-title"><h2>Atividade da plataforma</h2><button>Últimos 7 dias</button></div>
        <div className="owner-chart-area"><p className="owner-empty">Sem dados de atividade disponíveis.</p></div>
        <div className="owner-chart-tabs"><button className="active">Alunos ativos</button><button>Treinos realizados</button><button>Novos personais</button></div>
      </article>
      <article className="owner-panel owner-alerts">
        <div className="owner-panel-title"><h2>Alertas importantes</h2><button onClick={() => onNavigate("logs")}>Ver todos</button></div>
        {alerts.length ? alerts.slice(0, 4).map((alert, index) => <button className="owner-alert-row" key={`${alert}-${index}`} onClick={() => onNavigate("personals")}>
          <span className={`alert-icon tone-${index}`}><AlertTriangle/></span><span><strong>{alert}</strong></span>
        </button>) : <p className="owner-empty">Nenhum alerta disponível.</p>}
      </article>
    </section>

    <section className="owner-bottom-grid">
      <article className="owner-panel owner-recent-personals">
        <div className="owner-panel-title"><h2>Últimos personais cadastrados</h2><button onClick={() => onNavigate("personals")}>Ver todos</button></div>
        <div className="owner-recent-head"><span>Nome</span><span>Alunos</span><span>Cadastro</span><span>Status</span></div>
        {personals.length ? personals.map((person) => <button key={person.id} onClick={() => onNavigate("personals")}><span className="owner-person"><Avatar person={person}/><span><strong>{person.name}</strong><small>{person.email}</small></span></span><span>{person.student_count}</span><span>{new Date(person.created_at).toLocaleDateString("pt-BR")}</span><span className={`owner-status ${person.status}`}>{statusLabel[person.status] || person.status}</span></button>) : <p className="owner-empty">Nenhum personal cadastrado.</p>}
      </article>
      <article className="owner-panel owner-distribution"><h2>Distribuição de alunos</h2><p>Total de alunos: <strong>{summary.students_total}</strong></p><p>Detalhamento por status indisponível.</p></article>
      <article className="owner-panel owner-quick-actions"><h2>Ações rápidas</h2><button onClick={() => onNavigate("personals")}><Plus/><span><strong>Novo personal</strong><small>Cadastrar um personal na plataforma</small></span><ChevronRight/></button><button onClick={() => onNavigate("personals")}><Search/><span><strong>Revisar solicitações</strong><small>Ver cadastros e acessos pendentes</small></span><ChevronRight/></button><button onClick={() => onNavigate("logs")}><Activity/><span><strong>Ver logs de atividades</strong><small>Acessar logs e auditoria</small></span><ChevronRight/></button><button onClick={() => onNavigate("settings")}><Settings/><span><strong>Configurações da plataforma</strong><small>Editar configurações gerais</small></span><ChevronRight/></button></article>
    </section>
  </div>;
}
