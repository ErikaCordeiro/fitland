import { getLoginEndpoint, getRequestedContext } from "../utils/authRouting.js";
import { createAuthSessionCoordinator } from "../utils/authSessionCoordinator.js";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:8000/api");
const TOKEN_KEYS = {
  owner: "fitland_owner_token",
  personal: "fitland_personal_token",
  student: "fitland_student_token",
};
const SESSION_TOKEN_KEYS = {
  owner: "fitland_owner_session_token",
  personal: "fitland_personal_session_token",
  student: "fitland_student_session_token",
};
const FRONTEND_BUILD = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "unknown";
const authCoordinator = createAuthSessionCoordinator();

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeContext(context) {
  if (context === "superuser") return "owner";
  if (context === "aluno") return "student";
  return context || getRequestedContext(window.location.pathname)?.type || "personal";
}

export function getToken(context = null) {
  const normalized = normalizeContext(context);
  return localStorage.getItem(TOKEN_KEYS[normalized]) || sessionStorage.getItem(SESSION_TOKEN_KEYS[normalized]);
}

export function setToken(token, keepConnected = true, context = null) {
  const normalized = normalizeContext(context);
  clearToken(normalized);
  if (keepConnected) {
    localStorage.setItem(TOKEN_KEYS[normalized], token);
  } else {
    sessionStorage.setItem(SESSION_TOKEN_KEYS[normalized], token);
  }
}

export function clearToken(context = null) {
  const contexts = context ? [normalizeContext(context)] : Object.keys(TOKEN_KEYS);
  contexts.forEach((item) => {
    localStorage.removeItem(TOKEN_KEYS[item]);
    sessionStorage.removeItem(SESSION_TOKEN_KEYS[item]);
  });
  localStorage.removeItem("fitland_token");
  sessionStorage.removeItem("fitland_session_token");
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function rawRequest(path, options = {}) {
  const token = getToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  const requestId = options.requestId || createRequestId();
  if (path.startsWith("/auth/")) {
    console.info(`[frontend-auth] request=${requestId} method=${options.method || "GET"} path=${API_URL}${path} build=${FRONTEND_BUILD}`);
  }
  const diagnosticHeaders = { "X-Request-ID": requestId, "X-Frontend-Build": FRONTEND_BUILD };
  const headers = options.body instanceof FormData
    ? { ...diagnosticHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    : {
        "Content-Type": "application/json",
        ...diagnosticHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };

  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    signal: controller.signal,
    headers,
  }).finally(() => window.clearTimeout(timeout));
}

export async function apiRequest(path, options = {}) {
  let response = await rawRequest(path, options);

  const canRefresh = response.status === 401
    && !path.startsWith("/auth/login")
    && !path.startsWith("/auth/owner-login")
    && !path.startsWith("/auth/refresh")
    && !options.skipAuthRefresh;
  if (canRefresh) {
    const generation = authCoordinator.currentGeneration();
    try {
      await refreshSession();
      response = await rawRequest(path, options);
    } catch {
      if (generation === authCoordinator.currentGeneration()) clearToken();
    }
  }

  if (!response.ok) {
    const error = await parseResponse(response) || { detail: "Erro inesperado" };
    const requestError = new Error(error.detail || error.message || "Erro inesperado");
    requestError.code = error.code || null;
    requestError.status = response.status;
    throw requestError;
  }

  return parseResponse(response);
}

export async function login(email, password, keepConnected = true, ownerContext = false) {
  authCoordinator.beginAuthentication();
  const endpoint = getLoginEndpoint(ownerContext);
  console.info(`[frontend-auth] action=login ownerContext=${ownerContext} endpoint=${endpoint}`);
  const data = await apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify({ email, password, keep_connected: keepConnected }),
  });
  setToken(data.access_token, keepConnected, data.user?.role);
  return data;
}

export async function refreshSession() {
  const context = normalizeContext();
  console.info(`[frontend-auth] action=refresh context=${context} endpoint=/api/auth/refresh`);
  return authCoordinator.runRefresh(
    () => apiRequest("/auth/refresh", {
      method: "POST",
      timeoutMs: 12000,
      skipAuthRefresh: true,
      headers: { "X-Auth-Context": context },
    }),
    (data) => setToken(data.access_token, true, data.user?.role),
  );
}

export async function requestPasswordReset(email) {
  return apiRequest("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
    skipAuthRefresh: true,
  });
}

export async function confirmPasswordReset(token, newPassword, confirmPassword) {
  return apiRequest("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword, confirm_password: confirmPassword }),
    skipAuthRefresh: true,
  });
}

export async function logoutSession() {
  const context = normalizeContext();
  authCoordinator.invalidate();
  const request = apiRequest("/auth/logout", {
    method: "POST",
    timeoutMs: 2500,
    skipAuthRefresh: true,
    headers: { "X-Auth-Context": context },
  });
  clearToken(context);
  try {
    await request;
  } catch {
    // Local logout is authoritative when the remote revocation is unavailable.
  }
}
