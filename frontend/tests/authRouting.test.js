import test from "node:test";
import assert from "node:assert/strict";
import {
  getContextLoginPath,
  getLoginEndpoint,
  getRequestedContext,
  getRouteBranding,
  isAuthLoginPath,
  isOwnerLoginPath,
  isSessionCompatibleWithContext,
} from "../src/utils/authRouting.js";

test("Fitland login is always routed to the owner endpoint", () => {
  assert.equal(isOwnerLoginPath("/fitland/login"), true);
  assert.equal(isOwnerLoginPath("/fitland/login/"), true);
  assert.equal(getLoginEndpoint(isOwnerLoginPath("/fitland/login")), "/auth/owner-login");
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

test("student routes and sessions stay separate from personal context", () => {
  const student = { role: "student" };
  const personal = { role: "personal" };
  const studentContext = getRequestedContext("/dashboard/aluno");
  assert.deepEqual(studentContext, { type: "student", slug: null });
  assert.equal(isSessionCompatibleWithContext(student, studentContext), true);
  assert.equal(isSessionCompatibleWithContext(personal, studentContext), false);
  assert.equal(isSessionCompatibleWithContext(student, getRequestedContext("/personal/thiago-fillipo/login")), false);
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
});
