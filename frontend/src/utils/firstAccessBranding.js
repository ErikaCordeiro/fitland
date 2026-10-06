export const FIRST_ACCESS_BRANDING_FALLBACK = Object.freeze({
  display_name: "Seu Personal",
  initials: "SP",
  is_fallback: true,
});

export function firstAccessBrandingEndpoint(slug) {
  return `/branding/public?slug=${encodeURIComponent(slug)}`;
}

export function resolveFirstAccessBranding(branding, slug) {
  return branding?.slug === slug ? branding : FIRST_ACCESS_BRANDING_FALLBACK;
}
