function normalizePath(pathname = "") {
  return String(pathname).toLowerCase().replace(/\/+$/, "") || "/";
}

export const PUBLIC_AUTH_CONTEXT_KEY = "fitland_public_auth_context";

function normalizedRole(role = "") {
  if (role === "owner" || role === "superuser") return "owner";
  if (role === "student" || role === "aluno") return "student";
  return "personal";
}

function validContext(context) {
  if (!context || !["owner", "personal", "student"].includes(context.type)) return null;
  const slug = typeof context.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(context.slug)
    ? context.slug.toLowerCase()
    : null;
  return { type: context.type, slug };
}

export function readPublicAuthContext(storage = globalThis.localStorage) {
  try {
    return validContext(JSON.parse(storage?.getItem(PUBLIC_AUTH_CONTEXT_KEY) || "null"));
  } catch {
    return null;
  }
}

export function rememberPublicAuthContext(context, storage = globalThis.localStorage) {
  const safeContext = validContext(context);
  if (!safeContext || (safeContext.type !== "owner" && !safeContext.slug)) return null;
  storage?.setItem(PUBLIC_AUTH_CONTEXT_KEY, JSON.stringify(safeContext));
  return safeContext;
}

export function resolveLogoutContext({ role, pathname = "", branding = null, session = null, storedContext = null }) {
  const type = normalizedRole(role);
  if (type === "owner") return { type: "owner", slug: null };

  const routeContext = getRequestedContext(pathname);
  const routeSlug = routeContext?.type === type ? routeContext.slug : null;
  const stored = validContext(storedContext);
  const storedSlug = stored?.type === type ? stored.slug : null;
  const sessionSlug = session?.personal_slug || session?.tenant_slug || session?.slug || null;
  // Authenticated identity is authoritative. Generic app subroutes such as
  // /personal/financeiro must never be interpreted as tenant slugs.
  const slug = branding?.slug || sessionSlug || storedSlug || routeSlug || null;
  return validContext({ type, slug });
}

export function isOwnerLoginPath(pathname = "") {
  const normalized = normalizePath(pathname);
  return normalized === "/fitland/login" || normalized === "/owner/login";
}

export function isAuthLoginPath(pathname = "") {
  const normalized = normalizePath(pathname);
  return isOwnerLoginPath(normalized)
    || normalized === "/personal/login"
    || normalized === "/aluno/login"
    || /^\/personal\/[^/]+\/login$/.test(normalized)
    || /^\/personal\/[^/]+\/aluno\/login$/.test(normalized);
}

export function getLoginEndpoint(ownerContext = false) {
  return ownerContext ? "/auth/owner-login" : "/auth/login";
}

export function getRequestedContext(pathname = "") {
  const normalized = normalizePath(pathname);
  if (normalized.startsWith("/fitland/") || normalized.startsWith("/owner/")) {
    return { type: "owner", slug: null };
  }
  const brandedStudentMatch = normalized.match(/^\/personal\/([^/]+)\/aluno\/login$/);
  if (brandedStudentMatch) {
    return { type: "student", slug: brandedStudentMatch[1] };
  }
  if (normalized === "/aluno/login") return { type: "student", slug: null };
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
  if (context?.type === "student") return context.slug ? `/personal/${context.slug}/aluno/login` : "/aluno/login";
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
