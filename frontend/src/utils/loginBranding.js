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

export function visibleLoginBranding(branding, brandSlug, isOwnerContext) {
  return !isOwnerContext && brandSlug && branding?.slug !== brandSlug ? null : branding;
}

export function loginBrandingResponse(data, brandSlug, isOwnerContext) {
  if (isOwnerContext) return data;
  return data?.display_name && data?.is_fallback === false && data?.slug === brandSlug
    ? data
    : personalBrandFallback(brandSlug);
}

export function loginBrandingFailure(current, brandSlug, isOwnerContext) {
  if (isOwnerContext) return current?.display_name && !current.is_fallback
    ? current
    : { display_name: "Fitland", initials: "FT", is_fallback: true };
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
