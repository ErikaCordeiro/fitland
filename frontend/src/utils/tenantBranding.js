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

export function getContrastText(background = "#000000") {
  const value = String(background).trim().replace("#", "");
  const hex = value.length === 3 ? value.split("").map((item) => item + item).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#FFFFFF";
  const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#FFFFFF" : "#050505";
}

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
  const accent = branding.accent_color || "#C0C0C0";
  return {
    "--brand-primary": branding.primary_color || "#050505",
    "--brand-secondary": branding.secondary_color || "#C0C0C0",
    "--personal-bg": branding.background_color || "#050505",
    "--personal-surface": branding.surface_color || "#121416",
    "--personal-accent": accent,
    "--text-on-accent": getContrastText(accent),
    "--personal-border": branding.border_color || "#34373A",
    "--personal-text": branding.text_color || "#F5F5F5",
    "--personal-text-secondary": branding.muted_text_color || "#A7ABB0",
    "--personal-font": branding.font_family || "Inter",
    "--personal-logo-url": `url("${branding.logo_url || branding.icon_url || "/fitland-icon.svg"}")`,
  };
}
