import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const loginSource = readFileSync(new URL("../src/pages/Login.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("owner login has a dedicated premium structure without fake social access", () => {
  const ownerBranch = loginSource.slice(loginSource.indexOf("if (isOwnerContext)"), loginSource.indexOf("return (\n    <main className=\"login-screen\">"));
  assert.match(ownerBranch, /owner-login-screen/);
  assert.match(ownerBranch, /Performance, gestão e evolução\./);
  assert.match(ownerBranch, /fitland-owner-symbol\.png/);
  assert.match(ownerBranch, /PLATAFORMA DE GESTÃO FITNESS/);
  assert.doesNotMatch(ownerBranch, /Google|Apple|social-buttons/);
});

test("personal login remains on the established tenant layout", () => {
  assert.match(loginSource, /<main className="login-screen">/);
  assert.match(loginSource, /<section className="phone-frame" aria-label="Tela de login">/);
  assert.match(loginSource, /visualBranding\.display_name/);
});

test("owner login stylesheet includes responsive, focus and reduced-motion protections", () => {
  assert.match(styles, /\.owner-login-screen\s*\{/);
  assert.match(styles, /url\('\/fitland-owner-login-visual\.webp'\)/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.owner-login-visual\s*\{\s*display:\s*none/);
  assert.match(styles, /\.owner-login-submit:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.owner-login-screen/);
});

test("approved visual and transparent official symbol are optimized for web delivery", () => {
  const visualSize = statSync(new URL("../public/fitland-owner-login-visual.webp", import.meta.url)).size;
  const logoSize = statSync(new URL("../public/fitland-owner-symbol.png", import.meta.url)).size;
  assert.ok(visualSize > 50_000 && visualSize < 500_000);
  assert.ok(logoSize > 10_000 && logoSize < 250_000);
});
