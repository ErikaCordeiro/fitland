import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { filterNavigation, isPageEnabled, tenantThemeStyle } from "../src/utils/tenantBranding.js";

test("feature flags filter navigation and protect direct pages", () => {
  const items = [{ id: "dashboard" }, { id: "diet" }, { id: "coach" }];
  assert.deepEqual(filterNavigation(items, { diet: false }), [{ id: "dashboard" }, { id: "coach" }]);
  assert.equal(isPageEnabled("diet", { diet: false }), false);
  assert.equal(isPageEnabled("settings", { diet: false }), true);
});

test("tenant theme uses controlled CSS variables and safe defaults", () => {
  const style = tenantThemeStyle({ background_color: "#101010", font_family: "Poppins" });
  assert.equal(style["--personal-bg"], "#101010");
  assert.equal(style["--personal-font"], "Poppins");
  assert.equal(style["--personal-text"], "#F5F5F5");
});

test("different personals and their students receive isolated visual tokens", () => {
  const brandA = tenantThemeStyle({ display_name: "Personal A", logo_url: "/a.png", accent_color: "#3366FF" });
  const brandB = tenantThemeStyle({ display_name: "Personal B", logo_url: "/b.png", accent_color: "#22AA66" });
  assert.equal(brandA["--personal-logo-url"], 'url("/a.png")');
  assert.equal(brandB["--personal-logo-url"], 'url("/b.png")');
  assert.notEqual(brandA["--personal-accent"], brandB["--personal-accent"]);
  assert.deepEqual(tenantThemeStyle({}), {
    "--brand-primary": "#050505",
    "--brand-secondary": "#C0C0C0",
    "--personal-bg": "#050505",
    "--personal-surface": "#121416",
    "--personal-accent": "#C0C0C0",
    "--personal-border": "#34373A",
    "--personal-text": "#F5F5F5",
    "--personal-text-secondary": "#A7ABB0",
    "--personal-font": "Inter",
    "--personal-logo-url": 'url("/fitland-icon.svg")',
  });
});

test("application source contains no client-specific branding hardcode", () => {
  const sourceRoot = new URL("../src", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
  const files = [];
  const visit = (directory) => readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if ([".js", ".jsx", ".css"].includes(extname(entry.name))) files.push(path);
  });
  visit(sourceRoot);
  const source = files.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(source, /Thiago|Fillippo|Filippo|lion-juda-logo/i);
});
