import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { filterNavigation, getContrastText, isPageEnabled, tenantThemeStyle } from "../src/utils/tenantBranding.js";

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
  assert.equal(style["--text-on-accent"], "#050505");
});

test("accent text automatically selects the stronger WCAG contrast", () => {
  assert.equal(getContrastText("#111111"), "#FFFFFF");
  assert.equal(getContrastText("#F4D03F"), "#050505");
  assert.equal(getContrastText("#7C3AED"), "#FFFFFF");
  assert.equal(getContrastText("invalid"), "#FFFFFF");
});

function relativeLuminance(color) {
  const channels = color.replace("#", "").match(/.{2}/g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("semantic dark-surface text tokens meet WCAG AA in light mode", () => {
  assert.ok(contrastRatio("#F8F9FA", "#17191C") >= 4.5);
  assert.ok(contrastRatio("#C5C9CE", "#17191C") >= 4.5);
  assert.ok(contrastRatio("#8EEA7A", "#17191C") >= 4.5);
});

test("light theme preserves semantic dark-surface text instead of page text", () => {
  const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../src/pages/PersonalSettings.jsx", import.meta.url), "utf8");
  assert.match(settings, /admin-settings-hero semantic-dark-surface/);
  assert.match(settings, /admin-settings-card semantic-dark-surface/);
  assert.match(styles, /\.semantic-dark-surface[\s\S]*color:\s*var\(--text-on-dark\)\s*!important/);
  assert.match(styles, /\.semantic-dark-surface[\s\S]*:where\(p,small,\.eyebrow\)[\s\S]*color:\s*var\(--text-on-dark-muted\)\s*!important/);
  assert.match(styles, /\.semantic-dark-surface \.admin-plan-chip[\s\S]*color:\s*var\(--text-on-accent/);
  assert.match(styles, /\.owner-shell :where\(button,a,input,select,textarea,\[tabindex\]\):focus-visible/);
  assert.match(styles, /\.owner-shell :where\(button,input,select,textarea\)[\s\S]*min-height:\s*44px/);
  assert.match(styles, /:where\(\.personal-layout,\.student-layout-shell,\.owner-shell\) button\[aria-label\][\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/);
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
    "--text-on-accent": "#050505",
    "--personal-border": "#34373A",
    "--personal-text": "#F5F5F5",
    "--personal-text-secondary": "#A7ABB0",
    "--personal-font": "Inter",
    "--personal-logo-url": 'url("/fitland-icon.svg")',
  });
});

test("shared sidebar branding preserves full logos, compact icons and safe fallbacks", () => {
  const component = readFileSync(new URL("../src/components/LionLogo.jsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

  assert.match(component, /compact \? data\?\.icon_url \|\| data\?\.logo_url : data\?\.logo_url \|\| data\?\.icon_url/);
  assert.match(component, /has-wordmark-asset/);
  assert.match(component, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.match(component, /data\?\.initials \|\| "FT"/);
  assert.match(styles, /\.sidebar-header \.lion-mark img[\s\S]*object-fit:\s*contain\s*!important/);
  assert.match(styles, /\.sidebar-header \.lion-mark img[\s\S]*object-position:\s*center/);
  assert.match(styles, /\.sidebar\.collapsed \.sidebar-header[\s\S]*grid-template-rows:\s*44px 44px/);
  assert.match(styles, /Final tenant-branding layer[\s\S]*@media \(max-width: 980px\)[\s\S]*width:\s*100%\s*!important/);
  assert.match(styles, /\.sidebar\.collapsed \.sidebar-header \.lion-mark,[\s\S]*min-height:\s*44px\s*!important[\s\S]*max-height:\s*44px\s*!important/);
  assert.match(styles, /body\.theme-light[\s\S]*\.sidebar-header \.fitland-mark/);
  assert.match(styles, /\.sidebar-header \.fitland-mark[\s\S]*color:\s*#15181c\s*!important/);
});

test("owner surfaces define readable dark and light text, placeholders and focus", () => {
  const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
  assert.ok(contrastRatio("#F7F7F8", "#101214") >= 4.5);
  assert.ok(contrastRatio("#B9BDC5", "#101214") >= 4.5);
  assert.ok(contrastRatio("#17191D", "#FFFFFF") >= 4.5);
  assert.ok(contrastRatio("#4D545D", "#FFFFFF") >= 4.5);
  assert.match(styles, /\.owner-shell[\s\S]*--owner-text:\s*#f7f7f8/);
  assert.match(styles, /body\.owner-light \.owner-shell[\s\S]*--owner-text:\s*#17191d/);
  assert.match(styles, /\.owner-shell :where\(input,textarea\)::placeholder[\s\S]*opacity:\s*1/);
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
