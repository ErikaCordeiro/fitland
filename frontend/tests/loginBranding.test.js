import test from "node:test";
import assert from "node:assert/strict";
import { createLoginBrandingRequest, loginBrandingFailure, loginBrandingResponse, personalBrandFallback, visibleLoginBranding } from "../src/utils/loginBranding.js";

test("a valid public response stays effective after a late request failure", () => {
  const response = {
    display_name: "MucleBoom",
    slug: "hugo",
    is_fallback: false,
    personal_id: "tenant-1",
    logo_url: "/mucleboom.png",
    login_subtitle: "Treine. Evolua. Exploda.",
    primary_color: "#0A0A0A",
    accent_color: "#FF4B0B"
  };
  const resolved = loginBrandingResponse(response, "hugo", false);
  assert.equal(resolved, response);
  assert.equal(loginBrandingFailure(resolved, "hugo", false), response);
  assert.equal(resolved.display_name, "MucleBoom");
  assert.notEqual(resolved.display_name, "Personal Hugo");
  assert.equal(resolved.logo_url, "/mucleboom.png");
  assert.equal(resolved.login_subtitle, "Treine. Evolua. Exploda.");
});

test("public branding is selected by slug without crossing tenants", () => {
  const thiago = { display_name: "Personal Thiago Fillipo", slug: "thiago-fillipo", is_fallback: false, logo_url: "/lion.png" };
  assert.equal(loginBrandingResponse(thiago, "thiago-fillipo", false), thiago);
  assert.equal(loginBrandingFailure(thiago, "thiago-fillipo", false), thiago);
  assert.equal(loginBrandingResponse(thiago, "other", false).display_name, "Personal Other");
  assert.equal(loginBrandingFailure(thiago, "other", false), null);
  assert.equal(visibleLoginBranding(thiago, "other", false), null);
});

test("missing branding uses a tenant fallback and Owner remains independent", () => {
  assert.deepEqual(loginBrandingResponse({ display_name: "Fitland", is_fallback: true }, "new-coach", false), personalBrandFallback("new-coach"));
  assert.equal(loginBrandingFailure(null, "new-coach", false), null);
  const owner = { display_name: "Fitland", is_fallback: false };
  assert.equal(loginBrandingResponse(owner, "", true), owner);
  assert.equal(loginBrandingFailure(owner, "", true), owner);
});

test("first mount stays neutral until a valid tenant response arrives", () => {
  const platform = { display_name: "Fitland", is_fallback: true };
  assert.equal(visibleLoginBranding(platform, "hugo", false), null);
  assert.equal(visibleLoginBranding({ display_name: "Other", slug: "other", is_fallback: false }, "hugo", false), null);
  let applied = null;
  const request = createLoginBrandingRequest({
    brandSlug: "hugo", isOwnerContext: false,
    onResolved: (value) => { applied = value; },
    onRejected: () => assert.fail("valid first load should not reject")
  });
  const response = { display_name: "MucleBoom", slug: "hugo", is_fallback: false };
  request.resolve(response);
  assert.equal(applied, response);
  assert.equal(visibleLoginBranding(applied, "hugo", false), response);
});

test("cancelled requests cannot overwrite a newer tenant or report a late failure", () => {
  let applied = null;
  let failures = 0;
  const oldRequest = createLoginBrandingRequest({
    brandSlug: "tenant-a", isOwnerContext: false,
    onResolved: (value) => { applied = value; },
    onRejected: () => { failures += 1; }
  });
  oldRequest.cancel();
  const newRequest = createLoginBrandingRequest({
    brandSlug: "tenant-b", isOwnerContext: false,
    onResolved: (value) => { applied = value; },
    onRejected: () => { failures += 1; }
  });
  const tenantB = { display_name: "Brand B", slug: "tenant-b", is_fallback: false };
  newRequest.resolve(tenantB);
  oldRequest.resolve({ display_name: "Brand A", slug: "tenant-a", is_fallback: false });
  oldRequest.reject(new Error("late failure"));
  assert.equal(applied, tenantB);
  assert.equal(failures, 0);
});
