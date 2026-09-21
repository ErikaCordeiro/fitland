import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(new URL("../src/services/api.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("password changes use the email token endpoints", () => {
  assert.match(apiSource, /\/auth\/password-reset\/request/);
  assert.match(apiSource, /\/auth\/password-reset\/confirm/);
  assert.match(apiSource, /new_password/);
  assert.match(apiSource, /confirm_password/);
});

test("owner is not forced into an in-session password change", () => {
  assert.doesNotMatch(appSource, /session\.role === "owner" && session\.must_change_password/);
  assert.doesNotMatch(appSource, /RequiredPasswordChange/);
});
