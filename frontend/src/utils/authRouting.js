function normalizePath(pathname = "") {
  return String(pathname).toLowerCase().replace(/\/+$/, "") || "/";
}

export function isOwnerLoginPath(pathname = "") {
  const normalized = normalizePath(pathname);
  return normalized === "/fitland/login" || normalized === "/owner/login";
}

export function isAuthLoginPath(pathname = "") {
  const normalized = normalizePath(pathname);
  return isOwnerLoginPath(normalized) || normalized === "/personal/login" || /^\/personal\/[^/]+\/login$/.test(normalized);
}

export function getLoginEndpoint(ownerContext = false) {
  return ownerContext ? "/auth/owner-login" : "/auth/login";
}

export function getRequestedContext(pathname = "") {
  const normalized = normalizePath(pathname);
  if (normalized.startsWith("/fitland/") || normalized.startsWith("/owner/")) {
    return { type: "owner", slug: null };
  }
  if (normalized === "/personal/login") return { type: "personal", slug: null };
  const personalMatch = normalized.match(/^\/personal\/([^/]+)(?:\/|$)/);
  if (personalMatch) return { type: "personal", slug: personalMatch[1] };
  if (normalized.startsWith("/dashboard/personal") || normalized.startsWith("/admin/")) {
    return { type: "personal", slug: null };
  }
  if (normalized.startsWith("/dashboard/aluno") || normalized.startsWith("/aluno/")) {
    return { type: "student", slug: null };
  }
  return null;
}

export function isSessionCompatibleWithContext(user, context) {
  if (!user || !context) return true;
  if (context.type === "owner") return user.role === "owner" || user.role === "superuser";
  if (context.type === "student") return user.role === "student" || user.role === "aluno";
  if (user.role !== "personal") return false;
  const sessionSlug = user.personal_slug || user.tenant_slug || user.slug || null;
  return !context.slug || !sessionSlug || sessionSlug === context.slug;
}

export function getContextLoginPath(context) {
  if (context?.type === "owner") return "/fitland/login";
  return context?.slug ? `/personal/${context.slug}/login` : "/personal/login";
}

export function getRouteBranding(pathname = "", branding = null) {
  const context = getRequestedContext(pathname);
  if (context?.type === "owner") {
    return { title: "Fitland", favicon: "/fitland-icon.svg" };
  }
  if (context?.type === "personal") {
    return {
      title: branding?.display_name || "Personal",
      favicon: branding?.icon_url || branding?.logo_url || "/fitland-icon.svg",
    };
  }
  return {
    title: branding?.display_name || "Fitland",
    favicon: branding?.icon_url || branding?.logo_url || "/fitland-icon.svg",
  };
}

export function applyRouteBranding(pathname, branding = null) {
  if (typeof document === "undefined") return;
  const routeBrand = getRouteBranding(pathname, branding);
  document.title = routeBrand.title;
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.href = routeBrand.favicon;
  favicon.type = routeBrand.favicon.endsWith(".svg") ? "image/svg+xml" : "image/png";
}
