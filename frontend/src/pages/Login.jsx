import React, { useEffect, useState } from "react";
import { Apple, ArrowRight, Chrome, Download, Eye, EyeOff, Lock, Mail, X } from "lucide-react";
import LionLogo from "../components/LionLogo.jsx";
import { apiRequest, confirmPasswordReset, login as apiLogin, requestPasswordReset } from "../services/api.js";
import { applyRouteBranding } from "../utils/authRouting.js";
import { createLoginBrandingRequest, loginBrandingFailure, visibleLoginBranding } from "../utils/loginBranding.js";

export default function Login({ onLogin, onBrandingResolved, context = "platform", branding: initialBranding = null, brandSlug = "" }) {
  const [credentials, setCredentials] = useState({
    email: "",
    password: ""
  });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installMessage, setInstallMessage] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [branding, setBranding] = useState(() => visibleLoginBranding(initialBranding, brandSlug, context === "owner"));
  const [brandingLoadError, setBrandingLoadError] = useState(false);
  const [brandingRetry, setBrandingRetry] = useState(0);
  const isOwnerContext = context === "owner";
  const visualBranding = visibleLoginBranding(branding, brandSlug, isOwnerContext);
  const resetToken = new URLSearchParams(window.location.search).get("token");

  const requestReset = async (event) => {
    event.preventDefault();
    setResetError("");
    try {
      const email = String(new FormData(event.currentTarget).get("email") || "").trim();
      const result = await requestPasswordReset(email);
      setResetMessage(result?.detail || "Se o e-mail estiver cadastrado, enviaremos um link de redefinicao.");
    } catch (error) {
      setResetError(error.message);
    }
  };

  const completeReset = async (event) => {
    event.preventDefault();
    setResetError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("new_password") || "");
    const confirmation = String(form.get("confirm_password") || "");
    if (newPassword !== confirmation) {
      setResetError("As senhas nao coincidem.");
      return;
    }
    try {
      const result = await confirmPasswordReset(resetToken, newPassword, confirmation);
      window.history.replaceState(null, "", result?.context === "owner" ? "/fitland/login" : "/");
      setResetMessage("Senha redefinida. Entre com a nova senha.");
    } catch (error) {
      setResetError(error.message);
    }
  };

  useEffect(() => {
    const build = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "unknown";
    console.info(`[frontend] build=${build} pathname=${window.location.pathname} ownerContext=${isOwnerContext}`);
  }, [isOwnerContext]);

  useEffect(() => {
    applyRouteBranding(window.location.pathname, visualBranding);
    if (visualBranding?.display_name) onBrandingResolved?.(visualBranding);
  }, [visualBranding?.display_name, visualBranding?.icon_url, visualBranding?.logo_url, isOwnerContext, onBrandingResolved]);

  useEffect(() => {
    setBrandingLoadError(false);
    const endpoint = isOwnerContext || !brandSlug
      ? "/branding/platform"
      : `/branding/public?slug=${encodeURIComponent(brandSlug)}`;
    const request = createLoginBrandingRequest({
      brandSlug,
      isOwnerContext,
      onResolved: (resolved) => { setBranding(resolved); setBrandingLoadError(false); },
      onRejected: () => {
        setBranding((current) => loginBrandingFailure(current, brandSlug, isOwnerContext));
        setBrandingLoadError(true);
      }
    });
    apiRequest(endpoint, { skipAuthRefresh: true })
      .then(request.resolve, request.reject);
    return request.cancel;
  }, [isOwnerContext, brandSlug, brandingRetry]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
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
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOwnerContext && brandSlug && !visualBranding?.display_name) {
    return brandingLoadError
      ? <main className="login-screen login-loading-screen" role="alert"><p>Não foi possível carregar a identidade visual.</p><button type="button" onClick={() => setBrandingRetry((current) => current + 1)}>Tentar novamente</button></main>
      : <main className="login-screen login-loading-screen" role="status" aria-label="Carregando identidade visual" />;
  }

  const resetDialog = resetOpen && (
    <div className="signup-modal-backdrop" onMouseDown={() => setResetOpen(false)}>
      <form className="signup-modal password-reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onSubmit={requestReset} onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div><p className="eyebrow">Segurança</p><h2 id="reset-title">Redefinir senha por e-mail</h2><span>Enviaremos um link temporário para o e-mail cadastrado.</span></div>
          <button className="icon-button signup-close-button" type="button" onClick={() => setResetOpen(false)} aria-label="Fechar"><X size={22} /></button>
        </div>
        <label><span>E-mail</span><div className="input-shell"><Mail size={16} /><input name="email" type="email" defaultValue={credentials.email} autoComplete="email" required /></div></label>
        {resetMessage ? <p className="signup-success-message">{resetMessage}</p> : null}
        {resetError ? <p className="login-error">{resetError}</p> : null}
        <button className="metal-button inline" type="submit">Enviar link</button>
      </form>
    </div>
  );

  if (isOwnerContext) {
    return (
      <main className="owner-login-screen">
        <h1 className="sr-only">Acesso Fitland</h1>
        <section className="owner-login-visual" aria-labelledby="owner-login-title">
          <div className="sr-only">
            <h2 id="owner-login-title">Performance, gestão e evolução.</h2>
            <p>Tudo o que você precisa para acompanhar seus treinos, alunos e resultados em um só lugar.</p>
            <ul><li>Acompanhe seus resultados.</li><li>Gerencie seus alunos.</li><li>Mais disciplina e evolução.</li></ul>
          </div>
        </section>

        <section className="owner-login-auth" aria-label="Acesso à plataforma Fitland">
          <div className="owner-login-card">
            {resetToken ? <form className="owner-login-form" onSubmit={completeReset}>
              <div className="owner-login-brand-lockup"><img src="/fitland-owner-symbol.png" alt="" /><strong>FITLAND</strong><span>PLATAFORMA DE GESTÃO FITNESS</span></div>
              <div className="owner-login-heading"><h2>Redefinir senha</h2><p>Crie uma nova senha segura para continuar.</p></div>
              <label><span>Nova senha</span><div className="input-shell"><Lock size={18} /><input name="new_password" type="password" minLength={10} autoComplete="new-password" required /></div></label>
              <label><span>Confirmar nova senha</span><div className="input-shell"><Lock size={18} /><input name="confirm_password" type="password" minLength={10} autoComplete="new-password" required /></div></label>
              {resetError ? <p className="login-error" role="alert">{resetError}</p> : null}
              <button className="owner-login-submit" type="submit">Redefinir senha</button>
            </form> : <form className="owner-login-form" onSubmit={submit} aria-busy={isSubmitting}>
              <div className="owner-login-brand-lockup"><img src="/fitland-owner-symbol.png" alt="" /><strong>FITLAND</strong><span>PLATAFORMA DE GESTÃO FITNESS</span></div>
              <label>
                <span className="sr-only">E-mail</span>
                <div className="input-shell"><Mail size={18} /><input name="email" type="email" placeholder="seu@email.com" value={credentials.email} onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))} autoComplete="email" required /></div>
              </label>
              <label>
                <span className="sr-only">Senha</span>
                <div className="input-shell"><Lock size={18} /><input name="password" type={showPassword ? "text" : "password"} placeholder="Digite sua senha" value={credentials.password} onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))} minLength={8} autoComplete="current-password" required /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              </label>
              <div className="login-options-row">
                <label className="keep-connected-option"><input type="checkbox" checked={keepConnected} onChange={(event) => setKeepConnected(event.target.checked)} /><span>Lembrar de mim</span></label>
                <button className="forgot-link" type="button" onClick={() => { setResetOpen(true); setResetMessage(""); setResetError(""); }}>Esqueci minha senha</button>
              </div>
              {loginError ? <p className="login-error" role="alert">{loginError}</p> : null}
              <button className="owner-login-submit" type="submit" disabled={isSubmitting}><span>{isSubmitting ? "ENTRANDO..." : "ENTRAR"}</span><ArrowRight size={22} aria-hidden="true" /></button>
              <button className="owner-login-install" type="button" onClick={installApp}><Download size={17} />Instalar app</button>
              {installMessage ? <p className="install-app-hint" role="status">{installMessage}</p> : null}
            </form>}
          </div>
        </section>
        {resetDialog}
      </main>
    );
  }

  return (
    <main className="login-screen">
      <h1 className="sr-only">{visualBranding.display_name || "Fitland"}</h1>
      <div className="login-orbit" aria-hidden="true" />
      <section className="login-showcase">
        <LionLogo hero branding={visualBranding} platform={isOwnerContext} />
      </section>
      <section className="phone-frame" aria-label="Tela de login">
        <div className="phone-speaker" />
        {resetToken ? <form className="login-card" onSubmit={completeReset}>
          <LionLogo hero branding={visualBranding} platform={isOwnerContext} />
          <p className="welcome-copy">Redefinir senha</p>
          <label><span>Nova senha</span><div className="input-shell"><Lock size={16} /><input name="new_password" type="password" minLength={10} autoComplete="new-password" required /></div></label>
          <label><span>Confirmar nova senha</span><div className="input-shell"><Lock size={16} /><input name="confirm_password" type="password" minLength={10} autoComplete="new-password" required /></div></label>
          {resetError ? <p className="login-error">{resetError}</p> : null}
          <button className="metal-button" type="submit">Redefinir senha</button>
        </form> : <form className="login-card" onSubmit={submit}>
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
            <button className="forgot-link" type="button" onClick={() => { setResetOpen(true); setResetMessage(""); setResetError(""); }}>Esqueci minha senha</button>
          </div>
          {loginError ? <p className="login-error">{loginError}</p> : null}
          <button className="metal-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Entrando..." : "Entrar"}</button>
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
          {context === "student" && brandSlug && <small>
            Não tem uma conta?{" "}
            <a className="signup-link-button" href={`/personal/${encodeURIComponent(brandSlug)}/aluno/cadastro`}>Cadastre-se</a>
          </small>}
        </form>}
      </section>
      {resetDialog}
    </main>
  );
}
