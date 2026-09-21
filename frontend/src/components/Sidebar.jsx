import React, { useState } from "react";
import {
  Apple,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  FileText,
  Home,
  Info,
  LineChart,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Users,
  X
} from "lucide-react";
import LionLogo from "./LionLogo.jsx";
import { filterNavigation } from "../utils/tenantBranding.js";

export const personalNavItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "students", label: "Alunos", icon: Users },
  { id: "workout-builder", label: "Treinos", icon: Dumbbell },
  { id: "diet", label: "Dietas", icon: Apple },
  { id: "assessments", label: "Avaliações", icon: ClipboardCheck },
  { id: "progress", label: "Progresso", icon: LineChart },
  { id: "finance", label: "Financeiro", icon: CreditCard },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "chat", label: "Mensagens", icon: MessageCircle },
  { id: "reports", label: "Relatórios", icon: FileText },
  { id: "coach", label: "Coach IA", icon: Bot },
  { id: "about-personal", label: "Sobre o Personal", icon: Info },
  { id: "settings", label: "Configurações", icon: Settings }
];

export const studentNavItems = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "student-view", label: "Treinos", icon: Dumbbell },
  { id: "diet", label: "Dieta", icon: Apple },
  { id: "assessments", label: "Avaliações", icon: ClipboardCheck },
  { id: "progress", label: "Progresso", icon: BarChart3 },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "messages", label: "Mensagens", icon: MessageCircle },
  { id: "coach", label: "Assistente Fitness", icon: Bot },
  { id: "files", label: "Arquivos", icon: FileText },
  { id: "about-personal", label: "Sobre o Personal", icon: Info },
  { id: "settings", label: "Configurações", icon: Settings }
];

export default function Sidebar({
  activePage,
  onNavigate,
  mobileOpen = false,
  onClose,
  onCollapsedChange,
  navItems = personalNavItems,
  profileName = "Personal",
  profileRole = "Personal trainer",
  profileInitials = "TF",
  onLogout,
  branding,
  modules
}) {
  const [collapsed, setCollapsed] = useState(false);
  const effectiveCollapsed = collapsed && !mobileOpen;
  const isStudentMenu = navItems.some((item) => item.id === "payments");
  const inactive = new Set(["profile"]);
  const handleNavigate = (item) => {
    onNavigate(inactive.has(item.id) ? "dashboard" : item.id);
  };

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const nextValue = !value;
      onCollapsedChange?.(nextValue);
      return nextValue;
    });
  };

  return (
    <>
      <button
        className={`sidebar-overlay ${mobileOpen ? "show" : ""}`}
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <aside className={`sidebar ${effectiveCollapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <LionLogo compact={effectiveCollapsed} branding={branding} />
          <button
            className="sidebar-toggle menu-toggle"
            type="button"
            title={mobileOpen ? "Fechar menu" : effectiveCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={mobileOpen ? "Fechar menu" : effectiveCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!effectiveCollapsed}
            onClick={mobileOpen ? onClose : toggleCollapsed}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <nav className="nav-list" aria-label={isStudentMenu ? "Navegação do aluno" : "Navegação do personal"}>
          {filterNavigation(navItems, modules).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => handleNavigate(item)}
                type="button"
                title={effectiveCollapsed ? item.label : undefined}
                aria-current={activePage === item.id ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <button
            className="sidebar-logout"
            type="button"
            onClick={onLogout}
            title="Sair da conta"
          >
            <LogOut size={20} />
            <span>Sair da conta</span>
          </button>
          <small className="sidebar-copyright">Fitland Platform<br />© 2026 Todos os direitos reservados.</small>
        </div>
      </aside>
    </>
  );
}
