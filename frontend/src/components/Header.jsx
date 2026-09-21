import React, { useState } from "react";
import { Bell, CalendarDays, CheckCircle2, Menu, Moon, Search, Sparkles, Sun, UserPlus } from "lucide-react";

export default function Header({
  title,
  subtitle,
  user,
  student,
  variant = "personal",
  onMenuClick,
  onLogout,
  onCoachClick,
  notifications = [],
  onNotificationAction,
  onApproveStudent,
  theme = "dark",
  setTheme
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const firstName = user?.name?.split(" ")[0] || "Personal";
  const now = new Date();
  const currentDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(now);
  const currentWeekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(now);
  const studentHeading = title?.startsWith("Dieta") || title?.startsWith("Avaliac") ? "Bom dia," : "Bora treinar,";
  const heading = variant === "student" ? studentHeading : "Central de controle,";
  const visibleNotifications = notifications.length
    ? notifications
    : [
        {
          id: "empty",
          title: variant === "student" ? "Tudo certo por aqui" : "Nenhuma pendência agora",
          message: variant === "student" ? "Quando houver novidades do personal, elas aparecem aqui." : "Novos cadastros e alertas importantes aparecem aqui.",
          type: "info"
        }
      ];

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Performance Studio</p>
        <h1>
          {heading} <strong className="accent-name">{firstName}!</strong> <span aria-hidden="true">👋</span>
        </h1>
        <span>{activeSentence(title, subtitle)}</span>
      </div>
      <div className="topbar-actions">
        <button className="icon-button mobile-menu-trigger" type="button" aria-label="Abrir menu" onClick={onMenuClick}>
          <Menu size={19} />
        </button>
        <label className="search-shell compact-search">
          <Search size={18} />
          <input placeholder="Buscar aluno, treino ou exercício" />
        </label>
        <button className="icon-button glow-button" type="button" aria-label="Coach IA" onClick={onCoachClick}>
          <Sparkles size={19} />
        </button>
        <button
          className="icon-button app-theme-toggle"
          type="button"
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          onClick={() => setTheme?.(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <div className="notification-shell">
          <button
            className="icon-button"
            type="button"
            aria-label="Notificações"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((value) => !value)}
          >
            <Bell size={19} />
            {notifications.length > 0 ? <span className="notification-dot">{notifications.length}</span> : null}
          </button>
          {notificationsOpen && (
            <div className="notification-popover" role="dialog" aria-label="Notificações">
              <div className="notification-popover-header">
                <div>
                  <p className="eyebrow">Notificações</p>
                  <strong>{variant === "student" ? "Avisos do aluno" : "Central de aprovação"}</strong>
                </div>
                <button type="button" onClick={() => setNotificationsOpen(false)}>Fechar</button>
              </div>
              <div className="notification-list">
                {visibleNotifications.map((item) => (
                  <article key={item.id} className={`notification-item ${item.type || "info"}`}>
                    <span className="notification-icon">
                      {item.type === "student-signup" ? <UserPlus size={17} /> : <CheckCircle2 size={17} />}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      {item.student ? (
                        <small>{item.student.email} - {item.student.objective || "Objetivo não informado"}</small>
                      ) : null}
                      <div className="notification-actions">
                        {item.type === "student-signup" ? (
                          <button
                            type="button"
                            onClick={() => {
                              onApproveStudent?.(item.student);
                              setNotificationsOpen(false);
                            }}
                          >
                            Aceitar aluno
                          </button>
                        ) : null}
                        {item.actionLabel ? (
                          <button
                            type="button"
                            onClick={() => {
                              onNotificationAction?.(item);
                              setNotificationsOpen(false);
                            }}
                          >
                            {item.actionLabel}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="header-date">
          <CalendarDays size={19} />
          <div>
            <strong>{currentDate}</strong>
            <small>{currentWeekday.charAt(0).toUpperCase() + currentWeekday.slice(1)}</small>
          </div>
        </div>
        <div className="profile-chip">
          {student?.avatar ? (
            <img src={student.avatar} alt={student.name} />
          ) : (
            <span>{user?.name?.slice(0, 2) || "TF"}</span>
          )}
          <div>
            <strong>{user?.name || "Personal"}</strong>
            <small>{user?.role === "student" ? "Aluno" : "Personal"}</small>
          </div>
        </div>
      </div>
    </header>
  );
}

function activeSentence(title, subtitle) {
  if (title === "Dashboard do Personal") {
    return "Disciplina hoje, liberdade amanhã.";
  }
  return subtitle;
}
