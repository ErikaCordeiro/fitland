export const DEFAULT_MODULES = Object.freeze({
  workouts: true, diet: true, assessments: true, progress: true, finance: true,
  agenda: true, messages: true, reports: true, files: true, coach: true,
  calendar: true, payments: true,
});

const MODULE_BY_PAGE = {
  "workout-builder": "workouts", "student-view": "workouts", diet: "diet",
  assessments: "assessments", progress: "progress", finance: "finance",
  agenda: "agenda", chat: "messages", messages: "messages", reports: "reports",
  files: "files", coach: "coach", calendar: "calendar", payments: "payments",
};

export function resolvedModules(modules = {}) {
  return { ...DEFAULT_MODULES, ...(modules || {}) };
}

export function isPageEnabled(page, modules = {}) {
  const module = MODULE_BY_PAGE[page];
  return !module || resolvedModules(modules)[module] !== false;
}

export function filterNavigation(items, modules = {}) {
  return items.filter((item) => isPageEnabled(item.id, modules));
}

export function tenantThemeStyle(branding = {}) {
  return {
    "--brand-primary": branding.primary_color || "#050505",
    "--brand-secondary": branding.secondary_color || "#C0C0C0",
    "--personal-bg": branding.background_color || "#050505",
    "--personal-surface": branding.surface_color || "#121416",
    "--personal-accent": branding.accent_color || "#C0C0C0",
    "--personal-border": branding.border_color || "#34373A",
    "--personal-text": branding.text_color || "#F5F5F5",
    "--personal-text-secondary": branding.muted_text_color || "#A7ABB0",
    "--personal-font": branding.font_family || "Inter",
    "--personal-logo-url": `url("${branding.logo_url || branding.icon_url || "/fitland-icon.svg"}")`,
  };
}
