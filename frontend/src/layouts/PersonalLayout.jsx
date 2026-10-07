import React, { useState } from "react";
import Header from "../components/Header.jsx";
import Sidebar, { personalNavItems } from "../components/Sidebar.jsx";
import { tenantThemeStyle } from "../utils/tenantBranding.js";

export default function PersonalLayout({
  activePage,
  children,
  meta,
  onNavigate,
  onLogout,
  session,
  sidebarOpen,
  setSidebarOpen,
  student,
  notifications,
  onNotificationAction,
  onApproveStudent,
  branding,
  theme,
  setTheme,
  messageUnreadCount
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={`app-shell personal-layout ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`} style={tenantThemeStyle(branding)}>
      <Sidebar
        activePage={activePage}
        navItems={personalNavItems}
        onNavigate={onNavigate}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
        profileName={branding?.display_name || session?.name || "Personal"}
        branding={branding}
        modules={branding?.modules}
        messageUnreadCount={messageUnreadCount}
        profileRole="Personal trainer"
        profileInitials={branding?.initials || (session?.name || "Personal").split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}
        onLogout={onLogout}
      />
      <main className="main-panel personal-main">
        <Header
          title={meta[0]}
          subtitle={meta[1]}
          user={session}
          student={student}
          variant="personal"
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          notifications={notifications}
          onNotificationAction={onNotificationAction}
          onApproveStudent={onApproveStudent}
          theme={theme}
          setTheme={setTheme}
        />
        {children}
      </main>
    </div>
  );
}

