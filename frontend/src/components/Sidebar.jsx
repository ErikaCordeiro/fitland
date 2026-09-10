import React, { useState } from "react";
import {
  Apple,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
  UserCircle,
  Users
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
  const assistantName = isStudentMenu ? "Assistente Fitness" : "Coach IA";
  const assistantText = isStudentMenu
    ? "Tire dúvidas sobre execução, músculos, dieta e avaliação."
    : "Pergunte sobre treinos, dieta, evolução e mais.";
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
          <button
            className="sidebar-toggle menu-toggle"
            type="button"
            aria-label="Alternar menu"
            onClick={toggleCollapsed}
          >
            <Menu size={20} />
          </button>
          <LionLogo compact={effectiveCollapsed} branding={branding} />
        </div>

        <nav className="nav-list">
          {filterNavigation(navItems, modules).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => handleNavigate(item)}
                type="button"
                title={effectiveCollapsed ? item.label : undefined}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <span>{profileInitials}</span>
            <div>
              <strong>{profileName}</strong>
              <small>{profileRole}</small>
            </div>
          </div>

          <div className="sidebar-account-menu" aria-label="Menu do perfil">
            <button type="button" onClick={() => onNavigate("about-personal")}><UserCircle size={17} /><span>Meu Perfil</span></button>
            <button type="button" onClick={() => onNavigate("settings")}><Settings size={17} /><span>Configurações</span></button>
            <button type="button" onClick={() => onNavigate("coach")}><Bot size={17} /><span>Ajuda</span></button>
            <button type="button" onClick={() => onNavigate("about-personal")}><Info size={17} /><span>Sobre</span></button>
            <button className="logout-menu-button" type="button" onClick={onLogout}><LogOut size={17} /><span>Sair da conta</span></button>
          </div>

          <div className="coach-card">
            <Bot size={20} />
            <div>
              <strong>{assistantName}</strong>
              <span>{assistantText}</span>
            </div>
            <button type="button" onClick={() => onNavigate("coach")}>Conversar</button>
          </div>

          <button
            className="sidebar-toggle collapse-toggle"
            type="button"
            onClick={toggleCollapsed}
            aria-label={effectiveCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {effectiveCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            <span>{effectiveCollapsed ? "Expandir" : "Recolher"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
