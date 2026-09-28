export function personalBrandFallback(brandSlug) {
  const name = brandSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  return {
    display_name: `Personal ${name}`.trim(),
    slug: brandSlug,
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PT",
    logo_url: "",
    icon_url: "",
    login_subtitle: "Disciplina \u2022 Foco \u2022 Prop\u00f3sito",
    is_fallback: true
  };
}

const PLATFORM_LOGIN_BRANDING = Object.freeze({
  display_name: "Fitland",
  initials: "FT",
  logo_url: "",
  icon_url: "/fitland-icon.svg",
  login_subtitle: "Performance, gestao e evolucao",
  is_fallback: true
});

function isPlatformBranding(branding) {
  return branding?.display_name === "Fitland" && !branding?.slug && !branding?.personal_id;
}

export function visibleLoginBranding(branding, brandSlug, isOwnerContext) {
  if (isOwnerContext) return isPlatformBranding(branding) ? branding : PLATFORM_LOGIN_BRANDING;
  return !isOwnerContext && brandSlug && branding?.slug !== brandSlug ? null : branding;
}

export function loginBrandingResponse(data, brandSlug, isOwnerContext) {
  if (isOwnerContext) return isPlatformBranding(data) ? data : PLATFORM_LOGIN_BRANDING;
  return data?.display_name && data?.is_fallback === false && data?.slug === brandSlug
    ? data
    : personalBrandFallback(brandSlug);
}

export function loginBrandingFailure(current, brandSlug, isOwnerContext) {
  if (isOwnerContext) return isPlatformBranding(current) ? current : PLATFORM_LOGIN_BRANDING;
  if (current?.display_name && current?.slug === brandSlug && current?.is_fallback === false) return current;
  return null;
}

export function createLoginBrandingRequest({ brandSlug, isOwnerContext, onResolved, onRejected }) {
  let active = true;
  return {
    resolve(data) {
      if (active) onResolved(loginBrandingResponse(data, brandSlug, isOwnerContext));
    },
    reject(error) {
      if (active) onRejected(error);
    },
    cancel() {
      active = false;
    }
  };
}
