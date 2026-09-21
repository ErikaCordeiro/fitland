import React, { useState } from "react";
import { Activity, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";

const items = [
  ["dashboard", "Dashboard", LayoutDashboard], ["personals", "Personais", Users],
  ["logs", "Logs e atividades", Activity], ["settings", "Configurações", Settings], ["security", "Segurança", ShieldCheck],
];

export default function OwnerLayout({ session, activePage, onNavigate, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (page) => { onNavigate(page); setMobileOpen(false); };
  return <div className={`owner-shell ${collapsed ? "owner-collapsed" : ""}`}>
    <button className="owner-mobile-menu" type="button" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu /></button>
    {mobileOpen && <button className="owner-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`owner-sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="owner-sidebar-head">
        <div className="owner-fitland-logo"><span className="owner-fitland-mark">F</span><strong>FITLAND</strong></div>
        <button
          className="owner-sidebar-toggle"
          type="button"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(value => !value)}
        ><Menu /></button>
      </div>
      <button className="owner-close-mobile" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X /></button>
      <div className="owner-identity">
        {session.avatar_url ? <img src={session.avatar_url} alt={session.name || "Owner"} /> : <span>{(session.name || "O").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
        <div><strong>{session.name}</strong><small>SUPER USER</small></div>
      </div>
      <div className="owner-platform-brand"><strong>FITLAND</strong><small>Plataforma de gestão fitness</small></div>
      <nav aria-label="Navegação da dona">{items.map(([key, label, Icon]) => <button title={label} className={activePage === key ? "active" : ""} key={key} onClick={() => navigate(key)}><Icon /><span>{label}</span></button>)}</nav>
      <div className="owner-sidebar-footer">
        <button className="owner-logout" onClick={onLogout}><LogOut /><span>Sair da conta</span></button>
        <small className="owner-copyright">Fitland Platform<br />© 2026 Todos os direitos reservados.</small>
      </div>
    </aside>
    <main className="owner-main">{children}</main>
  </div>;
}
