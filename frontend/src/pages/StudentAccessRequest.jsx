import React, { useEffect, useState } from "react";
import { apiRequest } from "../services/api.js";
import { applyRouteBranding } from "../utils/authRouting.js";
import { firstAccessBrandingEndpoint, resolveFirstAccessBranding } from "../utils/firstAccessBranding.js";
import { tenantThemeStyle } from "../utils/tenantBranding.js";

export default function StudentAccessRequest({ slug, branding: initialBranding }) {
  const [branding, setBranding] = useState(() => resolveFirstAccessBranding(initialBranding, slug));
  const [brandingReady, setBrandingReady] = useState(initialBranding?.slug === slug);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(firstAccessBrandingEndpoint(slug), { skipAuthRefresh: true })
      .then((resolved) => {
        if (!active) return;
        const contextual = resolveFirstAccessBranding(resolved, slug);
        setBranding(contextual);
        applyRouteBranding(window.location.pathname, contextual);
      })
      .catch(() => {
        if (!active) return;
        const fallback = resolveFirstAccessBranding(null, slug);
        setBranding(fallback);
        applyRouteBranding(window.location.pathname, fallback);
      })
      .finally(() => active && setBrandingReady(true));
    return () => { active = false; };
  }, [slug]);

  const submit = async (event) => {
    event.preventDefault();
    if (status === "saving") return;
    const form = new FormData(event.currentTarget);
    setStatus("saving");
    setError("");
    try {
      await apiRequest(`/student-access-requests/public/${encodeURIComponent(slug)}`, {
        method: "POST",
        skipAuthRefresh: true,
        body: JSON.stringify({
          first_name: String(form.get("first_name") || "").trim(),
          last_name: String(form.get("last_name") || "").trim(),
          email: String(form.get("email") || "").trim(),
        }),
      });
      setStatus("success");
    } catch (requestError) {
      setStatus("idle");
      setError(requestError.message || "Não foi possível enviar sua solicitação.");
    }
  };

  const loginPath = `/personal/${encodeURIComponent(slug)}/aluno/login`;
  return <main className="student-first-access student-access-request" style={tenantThemeStyle(branding)}><section><header>{!brandingReady && <p role="status">Carregando identidade visual...</p>}{brandingReady && branding.logo_url && <img src={branding.logo_url} alt={branding.display_name || "Personal"}/>}<p className="eyebrow">{brandingReady ? branding.display_name : "Seu Personal"}</p><h1>{status === "success" ? "Solicitação enviada!" : "Solicite seu acesso"}</h1></header>{status === "success" ? <div className="student-access-request-success" role="status"><p>Seu Personal precisa aprovar seu acesso.</p><p>Assim que a solicitação for aprovada, você receberá as instruções para criar sua senha e acessar a plataforma.</p><a className="metal-button" href={loginPath}>Voltar para o login</a></div> : <form onSubmit={submit}><p>Preencha seus dados para solicitar acesso à plataforma do seu Personal.</p><label>Nome<input name="first_name" minLength="1" maxLength="80" required autoComplete="given-name"/></label><label>Sobrenome<input name="last_name" minLength="1" maxLength="100" required autoComplete="family-name"/></label><label>E-mail<input name="email" type="email" maxLength="255" required autoComplete="email"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="metal-button" type="submit" disabled={status === "saving"}>{status === "saving" ? "Enviando..." : "Solicitar acesso"}</button><p>Já possui uma conta? <a href={loginPath}>Entrar</a></p></form>}</section></main>;
}
