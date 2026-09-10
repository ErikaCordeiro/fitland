import React, { useEffect, useRef, useState } from "react";
import { Apple, Chrome, Download, Eye, EyeOff, Lock, Mail, UserPlus, X } from "lucide-react";
import LionLogo from "../components/LionLogo.jsx";
import { apiRequest, login as apiLogin } from "../services/api.js";
import { applyRouteBranding } from "../utils/authRouting.js";

function personalBrandFallback(brandSlug) {
  const name = brandSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  return {
    display_name: `Personal ${name}`.trim(),
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PT",
    logo_url: "",
    icon_url: "",
    login_subtitle: "Disciplina • Foco • Propósito",
    is_fallback: true
  };
}

export default function Login({ onLogin, onSignup, context = "platform", branding: initialBranding = null, brandSlug = "" }) {
  const [credentials, setCredentials] = useState({
    email: "",
    password: ""
  });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installMessage, setInstallMessage] = useState("");
  const [loginError, setLoginError] = useState("");
  const [keepConnected, setKeepConnected] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupErrors, setSignupErrors] = useState({});
  const [branding, setBranding] = useState(initialBranding);
  const signupDialogRef = useRef(null);
  const signupTriggerRef = useRef(null);
  const isOwnerContext = context === "owner";
  const visualBranding = branding;

  useEffect(() => {
    const build = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "unknown";
    console.info(`[frontend] build=${build} pathname=${window.location.pathname} ownerContext=${isOwnerContext}`);
  }, [isOwnerContext]);

  useEffect(() => {
    applyRouteBranding(window.location.pathname, visualBranding);
  }, [visualBranding?.display_name, isOwnerContext]);

  useEffect(() => {
    const endpoint = isOwnerContext || !brandSlug
      ? "/branding/platform"
      : `/branding/public?slug=${encodeURIComponent(brandSlug)}`;
    apiRequest(endpoint, { skipAuthRefresh: true })
      .then((data) => setBranding(
        !isOwnerContext && brandSlug && data?.display_name === "Fitland"
          ? personalBrandFallback(brandSlug)
          : data
      ))
      .catch(() => setBranding(isOwnerContext
        ? { display_name: "Fitland", initials: "FT", is_fallback: true }
        : personalBrandFallback(brandSlug)));
  }, [isOwnerContext, brandSlug]);

  useEffect(() => {
    if (isOwnerContext || brandSlug || !credentials.email.includes("@")) return undefined;
    const timer = window.setTimeout(() => {
      resolvePersonalBrand();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [credentials.email, isOwnerContext, brandSlug]);

  const resolvePersonalBrand = async () => {
    if (isOwnerContext || brandSlug || !credentials.email) return;
    try {
      const data = await apiRequest(`/branding/public?email=${encodeURIComponent(credentials.email)}`, { skipAuthRefresh: true });
      setBranding(data);
    } catch {
      setBranding((current) => current || { display_name: "Personal", initials: "PT", is_fallback: true });
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstallMessage("Instalação disponível no Android/Chrome. Toque em Instalar app para adicionar na tela inicial.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const getInstallFallbackMessage = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isChrome = /chrome|crios|edg/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|android/.test(userAgent);

    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      return "O app já está instalado neste dispositivo.";
    }

    if (isIOS) {
      return isSafari
        ? "No iPhone/iPad: abra no Safari, toque no ícone Compartilhar e escolha Adicionar a Tela de Início. O iOS não permite instalar por botão direto."
        : "No iPhone/iPad: copie/abra este link no Safari, toque em Compartilhar e depois em Adicionar a Tela de Início.";
    }

    if (isAndroid) {
      return isChrome
        ? "No Android/Chrome: toque em Instalar app. Se não aparecer, abra o menu do Chrome e escolha Instalar app ou Adicionar a Tela inicial."
        : "No Android: abra este link no Chrome e toque em Instalar app ou Adicionar a Tela inicial.";
    }

    return "No computador: use Chrome/Edge e clique no ícone de instalar na barra de endereço ou no menu do navegador > Instalar Fitland.";
  };

  const installApp = async () => {
    if (!installPrompt) {
      setInstallMessage(getInstallFallbackMessage());
      return;
    }

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallMessage(
      choice.outcome === "accepted"
        ? "Instalação iniciada. O app Fitland deve aparecer na tela inicial ou na lista de aplicativos."
        : getInstallFallbackMessage()
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoginError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    try {
      const result = await apiLogin(email, password, keepConnected, isOwnerContext);
      onLogin(result.user);
    } catch (error) {
      const message = error?.message || "Não foi possível entrar. Tente novamente.";
      setLoginError(
        message === "Invalid email or password"
          ? "E-mail ou senha inválidos."
          : message
      );
    }
  };

  const submitSignup = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errors = {};
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const age = Number(form.get("age"));
    const weight = Number(form.get("weight"));
    const height = Number(form.get("height"));
    const objective = String(form.get("objective") || "").trim();

    if (!name) errors.name = "Informe seu nome completo.";
    if (!email) errors.email = "Informe seu e-mail.";
    else if (!event.currentTarget.elements.email.validity.valid) errors.email = "Informe um e-mail válido.";
    if (!age || age < 12 || age > 100) errors.age = "Informe uma idade entre 12 e 100 anos.";
    if (!weight || weight < 30) errors.weight = "Informe um peso a partir de 30 kg.";
    if (!height || height < 1 || height > 2.5) errors.height = "Informe a altura em metros, por exemplo 1,67.";
    if (!objective) errors.objective = "Informe seu principal objetivo.";

    if (Object.keys(errors).length) {
      setSignupErrors(errors);
      event.currentTarget.querySelector(`[name="${Object.keys(errors)[0]}"]`)?.focus();
      return;
    }

    onSignup?.({
      name,
      email,
      age,
      weight,
      height,
      objective,
      notes: form.get("notes")
    });
    setSignupMessage("Cadastro enviado. aguarde aprovação do personal para liberar seu acesso.");
    setSignupOpen(false);
    event.currentTarget.reset();
  };

  const closeSignup = () => {
    setSignupOpen(false);
    setSignupErrors({});
    window.requestAnimationFrame(() => signupTriggerRef.current?.focus());
  };

  const clearSignupError = (event) => {
    const { name } = event.currentTarget;
    if (signupErrors[name]) setSignupErrors((current) => ({ ...current, [name]: undefined }));
  };

  useEffect(() => {
    if (!signupOpen) return undefined;
    const dialog = signupDialogRef.current;
    dialog?.querySelector("input")?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSignup();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll("button, input, textarea")].filter((element) => !element.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [signupOpen]);

  return (
    <main className="login-screen">
      <div className="login-orbit" aria-hidden="true" />
      <section className="login-showcase">
        <LionLogo hero branding={visualBranding} platform={isOwnerContext} />
      </section>
      <section className="phone-frame" aria-label="Tela de login">
        <div className="phone-speaker" />
        <form className="login-card" onSubmit={submit}>
          <LionLogo hero branding={visualBranding} platform={isOwnerContext} />
          <p className="welcome-copy">Bem-vindo</p>
          <label>
            <span>Email</span>
            <div className="input-shell">
              <Mail size={16} />
              <input
                name="email"
                type="email"
                placeholder="E-mail"
                value={credentials.email}
                onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
                onBlur={resolvePersonalBrand}
                required
              />
            </div>
          </label>
          <label>
            <span>Senha</span>
            <div className="input-shell">
              <Lock size={16} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={credentials.password}
                onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                minLength={8}
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <div className="login-options-row">
            <label className="keep-connected-option">
              <input
                type="checkbox"
                checked={keepConnected}
                onChange={(event) => setKeepConnected(event.target.checked)}
              />
              <span>Manter conectado</span>
            </label>
            <button className="forgot-link" type="button">Esqueci minha senha</button>
          </div>
          {loginError ? <p className="login-error">{loginError}</p> : null}
          <button className="metal-button" type="submit">Entrar</button>
          <button className="install-app-button" type="button" onClick={installApp}>
            <Download size={15} />
            Instalar app
          </button>
          {installMessage ? <p className="install-app-hint">{installMessage}</p> : null}
          <div className="login-divider">ou continue com</div>
          <div className="social-row">
            <button type="button" aria-label="Entrar com Google"><Chrome size={22} /></button>
            <button type="button" aria-label="Entrar com Apple"><Apple size={23} /></button>
          </div>
          {!isOwnerContext && <small>
            Não tem uma conta?{" "}
            <button ref={signupTriggerRef} className="signup-link-button" type="button" onClick={() => setSignupOpen(true)}>
              Cadastre-se
            </button>
          </small>}
          {signupMessage ? <p className="signup-success-message">{signupMessage}</p> : null}
        </form>
      </section>
      {signupOpen && (
        <div className="signup-modal-backdrop" onMouseDown={closeSignup}>
          <form ref={signupDialogRef} className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-title" aria-describedby="signup-description" noValidate onSubmit={submitSignup} onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Cadastro do aluno</p>
                <h2 id="signup-title">Solicitar acesso ao app</h2>
                <span id="signup-description">Preencha seus dados. O personal aprova seu cadastro antes de liberar o acesso.</span>
              </div>
              <button className="icon-button signup-close-button" type="button" onClick={closeSignup} aria-label="Fechar cadastro">
                <X size={22} />
              </button>
            </div>
            <div className="form-grid">
              <label><span>Nome completo</span><input name="name" required autoComplete="name" placeholder="Seu nome" aria-invalid={Boolean(signupErrors.name)} aria-describedby={signupErrors.name ? "signup-name-error" : undefined} onInput={clearSignupError} />{signupErrors.name && <small className="signup-field-error" id="signup-name-error" role="alert">{signupErrors.name}</small>}</label>
              <label><span>E-mail</span><input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" aria-invalid={Boolean(signupErrors.email)} aria-describedby={signupErrors.email ? "signup-email-error" : undefined} onInput={clearSignupError} />{signupErrors.email && <small className="signup-field-error" id="signup-email-error" role="alert">{signupErrors.email}</small>}</label>
              <label><span>Idade</span><input name="age" type="number" min="12" max="100" inputMode="numeric" required placeholder="Ex.: 65" aria-invalid={Boolean(signupErrors.age)} aria-describedby={signupErrors.age ? "signup-age-error" : undefined} onInput={clearSignupError} />{signupErrors.age && <small className="signup-field-error" id="signup-age-error" role="alert">{signupErrors.age}</small>}</label>
              <label><span>Peso</span><div className="signup-unit-field"><input name="weight" type="number" min="30" step="0.1" inputMode="decimal" required placeholder="70" aria-invalid={Boolean(signupErrors.weight)} aria-describedby={signupErrors.weight ? "signup-weight-error" : undefined} onInput={clearSignupError} /><span aria-hidden="true">kg</span></div>{signupErrors.weight && <small className="signup-field-error" id="signup-weight-error" role="alert">{signupErrors.weight}</small>}</label>
              <label><span>Altura</span><div className="signup-unit-field"><input name="height" type="number" min="1" max="2.5" step="0.01" inputMode="decimal" required placeholder="1,67" aria-invalid={Boolean(signupErrors.height)} aria-describedby={signupErrors.height ? "signup-height-error" : "signup-height-hint"} onInput={clearSignupError} /><span aria-hidden="true">m</span></div><small className={signupErrors.height ? "signup-field-error" : "signup-field-hint"} id={signupErrors.height ? "signup-height-error" : "signup-height-hint"} role={signupErrors.height ? "alert" : undefined}>{signupErrors.height || "Use metros, por exemplo 1,67 m."}</small></label>
              <label><span>Objetivo</span><input name="objective" required placeholder="Emagrecimento, hipertrofia..." aria-invalid={Boolean(signupErrors.objective)} aria-describedby={signupErrors.objective ? "signup-objective-error" : undefined} onInput={clearSignupError} />{signupErrors.objective && <small className="signup-field-error" id="signup-objective-error" role="alert">{signupErrors.objective}</small>}</label>
              <label className="wide">
                <span>Observações</span>
                <textarea name="notes" rows="4" placeholder="Lesões, rotina, restrições, preferências ou objetivo principal." />
              </label>
            </div>
            <button className="metal-button inline" type="submit">
              <UserPlus size={18} />
              Enviar cadastro
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
