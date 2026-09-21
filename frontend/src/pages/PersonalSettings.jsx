import React, { useEffect, useState } from "react";
import { Bell, Check, DollarSign, Dumbbell, Moon, Palette, Save, Sun, Upload, Users } from "lucide-react";
import { apiRequest } from "../services/api.js";

const emptyBranding = {
  display_name: "", logo_url: "", profile_image_url: "", icon_url: "",
  primary_color: "#050505", secondary_color: "#C0C0C0", login_subtitle: ""
};

export default function PersonalSettings({ profile = {}, studentCount = 0, workoutCount = 0, theme = "dark", setTheme }) {
  const [branding, setBranding] = useState(emptyBranding);
  const [toast, setToast] = useState("");
  const brandName = branding.display_name || "Personal";
  const brandImage = branding.profile_image_url || branding.logo_url || branding.icon_url || "/fitland-icon.svg";

  useEffect(() => {
    apiRequest("/branding/me").then(setBranding).catch(() => {});
  }, []);

  const notify = (text) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 3200);
  };

  const saveBranding = async () => {
    try {
      const saved = await apiRequest("/branding/me", { method: "PUT", body: JSON.stringify(branding) });
      setBranding(saved);
      notify("Identidade da marca salva com sucesso.");
    } catch (error) {
      notify(error.message || "Não foi possível salvar a marca.");
    }
  };

  const uploadBrandAsset = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiRequest(`/branding/upload/${type}`, { method: "POST", body: file, headers: { "Content-Type": file.type } });
      setBranding(result.branding);
      notify("Imagem da marca atualizada.");
    } catch (error) {
      notify(error.message || "Não foi possível enviar a imagem.");
    }
  };

  return (
    <section className="admin-settings-page">
      <header className="admin-settings-header">
        <div><h2>Configurações</h2><p>Gerencie sua identidade visual e preferências disponíveis.</p></div>
        <div className="admin-settings-header-actions"><button type="button" aria-label="Notificações"><Bell size={21} /></button></div>
      </header>
      {toast ? <div className="admin-settings-toast"><Check size={17} /> {toast}</div> : null}

      <article className="admin-settings-hero semantic-dark-surface">
        <div><small>Personal</small><h3>{brandName}</h3><span className="admin-plan-chip">Plano: não disponível</span><p>{branding.login_subtitle || "Identidade visual configurada"}</p></div>
        <HeroMetric icon={Users} value={String(studentCount)} label="Alunos ativos" trend={studentCount ? "Dados atuais" : "Sem alunos ainda"} />
        <HeroMetric icon={Dumbbell} value={String(workoutCount)} label="Treinos cadastrados" trend={workoutCount ? "Dados atuais" : "Sem treinos ainda"} />
        <HeroMetric icon={DollarSign} value="—" label="Faturamento" trend="Sem dados disponíveis" />
        <img src={branding.logo_url || brandImage} alt={`Marca ${brandName}`} />
      </article>

      <div className="admin-settings-grid">
        <SettingsCard number="1" title="Perfil Profissional" className="profile">
          <div className="admin-profile-card-body">
            <div className="admin-profile-photo"><img src={brandImage} alt={brandName} /></div>
            <div className="admin-profile-lines"><strong>{brandName}</strong><span>Informações profissionais ainda não cadastradas.</span>{profile.email ? <span>{profile.email}</span> : null}</div>
          </div>
        </SettingsCard>

        <SettingsCard number="2" title="Identidade da Marca">
          <div className="admin-brand-editor">
            <div className="admin-brand-logo">{branding.logo_url ? <img src={branding.logo_url} alt={`Logo ${brandName}`} /> : <span>{branding.initials || "PT"}</span>}</div>
            <label>Nome profissional<input value={branding.display_name || ""} onChange={(event) => setBranding({ ...branding, display_name: event.target.value })} /></label>
            <label>Texto do login<input value={branding.login_subtitle || ""} onChange={(event) => setBranding({ ...branding, login_subtitle: event.target.value })} /></label>
            <div className="admin-brand-colors">
              <label>Cor principal<input type="color" value={branding.primary_color || "#050505"} onChange={(event) => setBranding({ ...branding, primary_color: event.target.value })} /></label>
              <label>Cor secundária<input type="color" value={branding.secondary_color || "#C0C0C0"} onChange={(event) => setBranding({ ...branding, secondary_color: event.target.value })} /></label>
            </div>
            <div className="admin-brand-uploads">
              <label className="admin-settings-wide"><Upload size={15} /> Enviar logo<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadBrandAsset(event, "logo")} /></label>
              <label className="admin-settings-wide"><Upload size={15} /> Enviar foto<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadBrandAsset(event, "profile")} /></label>
            </div>
          </div>
          <button className="admin-settings-wide" type="button" onClick={saveBranding}><Save size={16} /> Salvar identidade</button>
        </SettingsCard>

        <SettingsCard number="3" title="Aparência">
          <span className="admin-settings-label">Tema do aplicativo</span>
          <div className="admin-settings-segment">
            <button className={theme === "dark" ? "active" : ""} type="button" onClick={() => setTheme?.("dark")}><Moon size={17} /> Escuro</button>
            <button className={theme === "light" ? "active" : ""} type="button" onClick={() => setTheme?.("light")}><Sun size={17} /> Claro</button>
          </div>
        </SettingsCard>

        <SettingsCard number="4" title="Demais configurações">
          <div className="tenant-data-state"><Palette size={24} /><strong>Ainda não disponível</strong><span>Configurações sem persistência não são exibidas como ativas.</span></div>
        </SettingsCard>
      </div>
    </section>
  );
}

function HeroMetric({ icon: Icon, value, label, trend }) {
  return <div className="admin-settings-hero-metric"><Icon size={31} /><strong>{value}</strong><span>{label}</span><small>{trend}</small></div>;
}

function SettingsCard({ number, title, children, className = "" }) {
  return <article className={`admin-settings-card semantic-dark-surface ${className}`}><h3><span>{number}.</span> {title}</h3>{children}</article>;
}
