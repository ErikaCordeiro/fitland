import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getContextLoginPath,
  getLegacyPersonalPage,
  getLoginEndpoint,
  getPersonalPagePath,
  getPersonalRoute,
  getRequestedContext,
  getRouteBranding,
  applyRouteBranding,
  isAuthLoginPath,
  isOwnerLoginPath,
  isSessionCompatibleWithContext,
  PUBLIC_AUTH_CONTEXT_KEY,
  readPublicAuthContext,
  rememberPublicAuthContext,
  resolvePersonalNavigation,
  resolveLogoutContext,
} from "../src/utils/authRouting.js";

test("Fitland login is always routed to the owner endpoint", () => {
  assert.equal(isOwnerLoginPath("/fitland/login"), true);
  assert.equal(isOwnerLoginPath("/fitland/login/"), true);
  assert.equal(getLoginEndpoint(isOwnerLoginPath("/fitland/login")), "/auth/owner-login");
});

test("logout uses the central context login path", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /resolveLogoutContext/);
  assert.match(appSource, /getContextLoginPath\(logoutContext\)/);
  assert.match(appSource, /setTenantData\(createTenantDataState\(\)\)/);
});

test("logout resolves owner and branded personal destinations", () => {
  assert.equal(getContextLoginPath(resolveLogoutContext({ role: "owner" })), "/fitland/login");
  assert.equal(getContextLoginPath(resolveLogoutContext({ role: "personal", branding: { slug: "thiago-fillipo" } })), "/personal/thiago-fillipo/login");
  assert.equal(getContextLoginPath(resolveLogoutContext({ role: "personal", branding: { slug: "hugo" } })), "/personal/hugo/login");
});

test("student logout preserves its personal tenant", () => {
  const context = resolveLogoutContext({
    role: "student",
    pathname: "/dashboard/aluno",
    storedContext: { type: "student", slug: "thiago-fillipo" },
  });
  assert.deepEqual(context, { type: "student", slug: "thiago-fillipo" });
  assert.equal(getContextLoginPath(context), "/personal/thiago-fillipo/aluno/login");
});

test("public auth context stores no private session data", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  rememberPublicAuthContext({ type: "personal", slug: "thiago-fillipo", access_token: "secret", student: { id: "private" } }, storage);
  assert.equal(values.has(PUBLIC_AUTH_CONTEXT_KEY), true);
  assert.deepEqual(JSON.parse(values.get(PUBLIC_AUTH_CONTEXT_KEY)), { type: "personal", slug: "thiago-fillipo" });
  assert.deepEqual(readPublicAuthContext(storage), { type: "personal", slug: "thiago-fillipo" });
});

test("authenticated branding takes priority over generic personal subroutes", () => {
  assert.deepEqual(resolveLogoutContext({
    role: "personal", pathname: "/personal/financeiro", branding: { slug: "hugo" },
    storedContext: { type: "personal", slug: "old-personal" },
  }), { type: "personal", slug: "hugo" });
  for (const route of ["financeiro", "treinos", "alunos", "progresso"]) {
    const context = resolveLogoutContext({ role: "personal", pathname: `/personal/${route}`, branding: { slug: "hugo" } });
    assert.equal(getContextLoginPath(context), "/personal/hugo/login");
  }
});

test("logout from every generic Hugo page remains contextual and never targets settings", () => {
  for (const pathname of ["/personal/financeiro", "/personal/alunos", "/personal/treinos", "/personal/progresso"]) {
    const context = resolveLogoutContext({ role: "personal", pathname, branding: { slug: "hugo" } });
    assert.equal(getContextLoginPath(context), "/personal/hugo/login");
    assert.notEqual(getContextLoginPath(context), "/admin/configuracoes");
  }
});

test("logout clears the local session before waiting for remote revocation", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const apiSource = readFileSync(new URL("../src/services/api.js", import.meta.url), "utf8");
  const flowStart = appSource.indexOf("const remoteLogout = logoutSession()");
  const navigate = appSource.indexOf("window.history.replaceState(null, \"\", loginPath)", flowStart);
  const clearSession = appSource.indexOf("setSession(null)", flowStart);
  const waitRemote = appSource.indexOf("await remoteLogout", flowStart);
  assert.ok(flowStart >= 0 && navigate > flowStart && clearSession > navigate && waitRemote > clearSession);
  assert.match(apiSource, /timeoutMs: 2500/);
  assert.match(apiSource, /skipAuthRefresh: true/);
  assert.ok(apiSource.indexOf("clearToken(context)", apiSource.indexOf("export async function logoutSession")) < apiSource.indexOf("await request", apiSource.indexOf("export async function logoutSession")));
});

test("typing an email never changes route branding", () => {
  const loginSource = readFileSync(new URL("../src/pages/Login.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(loginSource, /branding\/public\?email=/);
  assert.doesNotMatch(loginSource, /resolvePersonalBrand/);
});

test("context changes update title and favicon together", () => {
  const favicon = { href: "", type: "" };
  global.document = {
    title: "",
    querySelector: () => favicon,
    createElement: () => favicon,
    head: { appendChild: () => {} },
  };
  applyRouteBranding("/fitland/dashboard", { display_name: "Personal A", icon_url: "/a.png" });
  assert.equal(document.title, "Fitland");
  assert.match(favicon.href, /fitland-icon\.svg$/);
  applyRouteBranding("/personal/personal-a/login", { display_name: "Personal A", icon_url: "/a.png" });
  assert.equal(document.title, "Personal A");
  assert.match(favicon.href, /a\.png$/);
  delete global.document;
});

test("personal login uses the regular auth endpoint", () => {
  assert.equal(isOwnerLoginPath("/personal/thiago-fillipo/login"), false);
  assert.equal(isAuthLoginPath("/personal/login"), true);
  assert.deepEqual(getRequestedContext("/personal/login"), { type: "personal", slug: null });
  assert.equal(getLoginEndpoint(false), "/auth/login");
});

test("owner and personal login pages do not restore another active role", () => {
  assert.equal(isAuthLoginPath("/fitland/login"), true);
  assert.equal(isAuthLoginPath("/owner/login/"), true);
  assert.equal(isAuthLoginPath("/personal/thiago-fillipo/login"), true);
  assert.equal(isAuthLoginPath("/fitland/dashboard"), false);
  assert.equal(isAuthLoginPath("/dashboard/personal"), false);
});

test("route context, not an old session, controls cross-context navigation", () => {
  const owner = { role: "owner" };
  const thiago = { role: "personal", personal_slug: "thiago-fillipo" };
  const fitland = getRequestedContext("/fitland/login");
  const personal = getRequestedContext("/personal/thiago-fillipo/login");

  assert.equal(isSessionCompatibleWithContext(owner, fitland), true);
  assert.equal(isSessionCompatibleWithContext(thiago, personal), true);
  assert.equal(isSessionCompatibleWithContext(thiago, fitland), false);
  assert.equal(isSessionCompatibleWithContext(owner, personal), false);
});

test("personal slugs remain isolated when the session exposes tenant identity", () => {
  const thiago = { role: "personal", personal_slug: "thiago-fillipo" };
  assert.equal(isSessionCompatibleWithContext(thiago, getRequestedContext("/personal/maria/login")), false);
  assert.equal(getContextLoginPath(getRequestedContext("/personal/maria/dashboard")), "/personal/maria/login");
  assert.equal(getContextLoginPath({ type: "personal", slug: null }), "/personal/login");
});

test("personal pages use canonical tenant-scoped routes for any valid slug", () => {
  const expected = {
    dashboard: "dashboard",
    students: "alunos",
    "workout-builder": "treinos",
    diet: "dietas",
    assessments: "avaliacoes",
    progress: "progresso",
    finance: "financeiro",
    agenda: "agenda",
    chat: "mensagens",
    reports: "relatorios",
    coach: "coach-ia",
    "about-personal": "sobre-o-personal",
    settings: "configuracoes",
  };
  for (const [page, segment] of Object.entries(expected)) {
    const path = `/personal/tenant-example/${segment}`;
    assert.equal(getPersonalPagePath("tenant-example", page), path);
    assert.deepEqual(getPersonalRoute(path), { slug: "tenant-example", page });
  }
  assert.deepEqual(getPersonalRoute("/personal/tenant-example/progresso"), { slug: "tenant-example", page: "progress" });
});

test("tenant-scoped routes preserve their page while replacing a foreign slug", () => {
  const requested = getPersonalRoute("/personal/tenant-a/treinos");
  assert.deepEqual(requested, { slug: "tenant-a", page: "workout-builder" });
  assert.equal(getPersonalPagePath("tenant-b", requested.page), "/personal/tenant-b/treinos");
});

test("authenticated personal routing preserves F5 and blocks cross-tenant URL context", () => {
  assert.deepEqual(resolvePersonalNavigation("/personal/hugo/treinos", "hugo"), {
    page: "workout-builder",
    path: "/personal/hugo/treinos",
    redirect: false,
  });
  assert.deepEqual(resolvePersonalNavigation("/personal/thiago-fillipo/dashboard", "hugo"), {
    page: "dashboard",
    path: "/personal/hugo/dashboard",
    redirect: true,
  });
  assert.deepEqual(resolvePersonalNavigation("/personal/hugo/progresso", "thiago-fillipo"), {
    page: "progress",
    path: "/personal/thiago-fillipo/progresso",
    redirect: true,
  });
});

test("legacy personal aliases resolve to pages without becoming tenant slugs", () => {
  const aliases = {
    "/dashboard/personal": "dashboard",
    "/dashboard/personal/dietas": "diet",
    "/personal/progresso": "progress",
    "/admin/configuracoes": "settings",
    "/financeiro": "finance",
    "/mensagens": "chat",
  };
  for (const [pathname, page] of Object.entries(aliases)) {
    assert.equal(getLegacyPersonalPage(pathname), page);
    assert.deepEqual(getRequestedContext(pathname), { type: "personal", slug: null });
    assert.equal(getPersonalPagePath("tenant-example", page).startsWith("/personal/tenant-example/"), true);
  }
  assert.deepEqual(resolvePersonalNavigation("/admin/configuracoes", "hugo"), {
    page: "settings",
    path: "/personal/hugo/configuracoes",
    redirect: true,
  });
});

test("student progress details are tenant-scoped without authorizing by URL slug", () => {
  const path = getPersonalPagePath("tenant-example", "student-progress-detail", { studentId: "student-123" });
  assert.equal(path, "/personal/tenant-example/aluno/student-123/progresso");
  assert.deepEqual(getPersonalRoute(path), {
    slug: "tenant-example",
    page: "student-progress-detail",
    studentId: "student-123",
  });
});

test("student routes and sessions stay separate from personal context", () => {
  const student = { role: "student" };
  const personal = { role: "personal" };
  const studentContext = getRequestedContext("/dashboard/aluno");
  assert.deepEqual(studentContext, { type: "student", slug: null });
  assert.equal(isSessionCompatibleWithContext(student, studentContext), true);
  assert.equal(isSessionCompatibleWithContext(personal, studentContext), false);
  assert.equal(isSessionCompatibleWithContext(student, getRequestedContext("/personal/thiago-fillipo/login")), false);
  assert.equal(isAuthLoginPath("/personal/thiago-fillipo/aluno/login"), true);
  assert.deepEqual(getRequestedContext("/personal/thiago-fillipo/aluno/login"), { type: "student", slug: "thiago-fillipo" });
  assert.equal(getContextLoginPath({ type: "student", slug: "thiago-fillipo" }), "/personal/thiago-fillipo/aluno/login");
});

test("branding follows the requested URL", () => {
  assert.deepEqual(getRouteBranding("/fitland/login", { display_name: "Personal Antigo" }), {
    title: "Fitland",
    favicon: "/fitland-icon.svg",
  });
  assert.deepEqual(getRouteBranding("/personal/thiago-fillipo/login"), {
    title: "Personal",
    favicon: "/fitland-icon.svg",
  });
  assert.deepEqual(getRouteBranding("/personal/maria/login", { display_name: "Personal Maria", icon_url: "/maria.png" }), {
    title: "Personal Maria",
    favicon: "/maria.png",
  });
  assert.deepEqual(getRouteBranding("/personal/maria/aluno/login", { display_name: "Personal Maria", icon_url: "/maria.png" }), {
    title: "Personal Maria",
    favicon: "/maria.png",
  });
});
