import React, { useEffect, useState } from "react";
import { apiRequest } from "../services/api.js";
import {
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  Database,
  DollarSign,
  Download,
  Dumbbell,
  FileText,
  Globe2,
  Image,
  KeyRound,
  Lock,
  Palette,
  RefreshCcw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
  Moon,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  Users
} from "lucide-react";

const studentConfig = ["Aprovação automática de alunos", "Exigir avaliação inicial", "Exigir foto de evolução", "Permitir agendamento online", "Permitir remarcação"];
const adminNotifications = ["Novo aluno", "Consulta agendada", "Consulta remarcada", "Novo pagamento", "Novo arquivo enviado", "Nova mensagem"];
const aiSettings = ["Habilitar Coach IA", "Análise de progresso", "Análise financeira", "Recomendações inteligentes", "Insights de alunos"];
const privacySettings = ["Consentimento obrigatorio (LGPD)", "Compartilhamento de dados", "Armazenamento de exames"];

export default function PersonalSettings({ profile = {} }) {
  const [branding, setBranding] = useState({ display_name: "Fitland", logo_url: "", profile_image_url: "", icon_url: "", primary_color: "#050505", secondary_color: "#C0C0C0", login_subtitle: "" });
  const [toggles, setToggles] = useState({
    automaticApproval: false,
    initialAssessment: true,
    progressPhoto: true,
    onlineSchedule: true,
    reschedule: true,
    newStudent: true,
    appointment: true,
    rescheduled: true,
    payment: true,
    file: true,
    message: true,
    coach: true,
    progressAi: true,
    financeAi: true,
    smartRecommendations: true,
    studentInsights: true,
    lgpd: true,
    dataSharing: true,
    examStorage: true
  });
  const [remakeLimit, setRemakeLimit] = useState("2");
  const [theme, setTheme] = useState("dark");
  const [toast, setToast] = useState("");
  const [armedAction, setArmedAction] = useState(null);
  const brandName = branding.display_name || "Fitland";
  const brandImage = branding.profile_image_url || branding.logo_url || branding.icon_url || "/fitland-icon.svg";

  useEffect(() => {
    apiRequest("/branding/me").then(setBranding).catch(() => {});
  }, []);

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

  const toggle = (key) => setToggles((current) => ({ ...current, [key]: !current[key] }));
  const notify = (text) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <section className="admin-settings-page">
      <header className="admin-settings-header">
        <div>
          <h2>Configurações</h2>
          <p>Gerencie todas as configurações do seu negócio.</p>
        </div>
        <div className="admin-settings-header-actions">
          <button type="button" aria-label="Notificações"><Bell size={21} /><i>3</i></button>
          <button type="button" className="admin-settings-admin-chip"><img src={brandImage} alt="" /><span><strong>{brandName}</strong><small>Administrador</small></span><ChevronRight size={17} /></button>
        </div>
      </header>

      {toast && <div className="admin-settings-toast"><Check size={17} /> {toast}</div>}

      <article className="admin-settings-hero">
        <div>
          <small>Personal</small>
          <h3>{brandName}</h3>
          <span className="admin-plan-chip"><Trophy size={16} /> Plano Premium</span>
          <p>Disciplina - Foco - Propósito</p>
        </div>
        <HeroMetric icon={Users} value="128" label="Alunos ativos" trend="+12% este mês" />
        <HeroMetric icon={Dumbbell} value="482" label="Treinos concluidos" trend="+18% este mês" />
        <HeroMetric icon={DollarSign} value="R$ 24.580" label="Faturados este mês" trend="+15% este mês" />
        <img src={branding.logo_url || "/fitland-icon.svg"} alt={`Marca ${brandName}`} />
      </article>

      <div className="admin-settings-grid">
        <SettingsCard number="1" title="Perfil Profissional" icon={UserRound} className="profile">
          <div className="admin-profile-card-body">
            <div className="admin-profile-photo"><img src={brandImage} alt={brandName} /><button type="button"><Upload size={15} /></button></div>
            <div className="admin-profile-lines">
              <strong>{brandName}</strong>
              <span>CREF: 123456-G/SP</span>
              <span>{profile.email || "E-mail não informado"}</span>
              <span>(11) 98765-4321</span>
              <span>{profile.instagram || "Instagram não informado"}</span>
            </div>
          </div>
          <button className="admin-settings-wide" type="button" onClick={() => notify("Perfil profissional preparado para edicao.")}>Editar perfil</button>
        </SettingsCard>

        <SettingsCard number="2" title="Identidade da Marca" icon={Palette}>
          <div className="admin-brand-editor">
            <div className="admin-brand-logo">
              {branding.logo_url ? <img src={branding.logo_url} alt={`Logo ${branding.display_name}`} /> : <span>{branding.initials || "FT"}</span>}
            </div>
            <label>Nome profissional<input value={branding.display_name || ""} onChange={(event) => setBranding({ ...branding, display_name: event.target.value })} /></label>
            <label>Texto do login<input value={branding.login_subtitle || ""} onChange={(event) => setBranding({ ...branding, login_subtitle: event.target.value })} /></label>
            <div className="admin-brand-colors">
              <label>Cor principal<input type="color" value={branding.primary_color || "#050505"} onChange={(event) => setBranding({ ...branding, primary_color: event.target.value })} /></label>
              <label>Cor secundária<input type="color" value={branding.secondary_color || "#C0C0C0"} onChange={(event) => setBranding({ ...branding, secondary_color: event.target.value })} /></label>
            </div>
            <div className="admin-brand-uploads">
              <label className="admin-settings-wide">Enviar logo<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadBrandAsset(event, "logo")} /></label>
              <label className="admin-settings-wide">Enviar foto<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadBrandAsset(event, "profile")} /></label>
            </div>
          </div>
          <button className="admin-settings-wide" type="button" onClick={saveBranding}>Salvar identidade</button>
        </SettingsCard>

        <SettingsCard number="3" title="Configuração de Alunos" icon={Users}>
          <ToggleList labels={studentConfig} keys={["automaticApproval", "initialAssessment", "progressPhoto", "onlineSchedule", "reschedule"]} toggles={toggles} onToggle={toggle} />
          <label className="admin-settings-inline-select"><span>Limite de remarcações</span><select value={remakeLimit} onChange={(event) => setRemakeLimit(event.target.value)}><option>1</option><option>2</option><option>3</option><option>Sem limite</option></select></label>
          <button className="admin-settings-wide" type="button" onClick={() => notify("Configurações de alunos salvas.")}>Salvar configurações</button>
        </SettingsCard>

        <SettingsCard number="4" title="Agenda" icon={CalendarDays}>
          <AdminLine label="Dias de atendimento" action="Configurar horários" onClick={() => notify("Configuração de horários aberta.")} />
          <label className="admin-settings-inline-select"><span>Intervalo entre consultas</span><select defaultValue="60"><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option></select></label>
          <AdminLine label="Feriados" action="Gerenciar" onClick={() => notify("Gerenciamento de feriados aberto.")} />
          <AdminLine label="Bloqueios" action="Gerenciar" onClick={() => notify("Bloqueios de agenda abertos.")} />
        </SettingsCard>

        <SettingsCard number="5" title="Financeiro" icon={CreditCard}>
          <div className="admin-settings-table-lines">
            <span><small>Pix</small><em>Ativado</em></span>
            <span><small>Mercado Pago</small><em>Ativado</em></span>
            <span><small>Stripe</small><b>Em breve</b></span>
            <span><small>Plano padrão</small><select defaultValue="mensal"><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option></select></span>
            <span><small>Plano mensal</small><strong>R$ 149,90</strong></span>
            <span><small>Plano trimestral</small><strong>R$ 399,90</strong></span>
          </div>
          <button className="admin-settings-wide" type="button" onClick={() => notify("Configuração de pagamentos aberta.")}>Configurar pagamentos</button>
        </SettingsCard>

        <SettingsCard number="6" title="Notificações" icon={Bell}>
          <ToggleList labels={adminNotifications} keys={["newStudent", "appointment", "rescheduled", "payment", "file", "message"]} toggles={toggles} onToggle={toggle} />
          <button className="admin-settings-wide" type="button" onClick={() => notify("Preferências de notificação atualizadas.")}>Gerenciar notificações</button>
        </SettingsCard>

        <SettingsCard number="7" title="Coach IA" icon={Bot}>
          <ToggleList labels={aiSettings} keys={["coach", "progressAi", "financeAi", "smartRecommendations", "studentInsights"]} toggles={toggles} onToggle={toggle} />
          <button className="admin-settings-wide" type="button" onClick={() => notify("Configurações do Coach IA abertas.")}>Configurar IA</button>
        </SettingsCard>

        <SettingsCard number="8" title="Aplicativo" icon={Smartphone}>
          <span className="admin-settings-label">Tema</span>
          <div className="admin-settings-segment"><button className={theme === "dark" ? "active" : ""} type="button" onClick={() => setTheme("dark")}><Moon size={17} /> Escuro</button><button className={theme === "light" ? "active" : ""} type="button" onClick={() => setTheme("light")}><Sun size={17} /> Claro</button></div>
          <label className="admin-settings-select"><span>Idioma</span><select defaultValue="pt"><option value="pt">Português (Brasil)</option></select></label>
          <button className="admin-settings-wide" type="button" onClick={() => notify("Preferências do aplicativo salvas.")}>Salvar preferências</button>
        </SettingsCard>

        <SettingsCard number="9" title="Segurança" icon={Lock}>
          <div className="admin-security-lines connected-devices-grid">
            <button type="button"><Smartphone size={17} /> Dispositivos conectados <small>Navegador/PWA - sessão atual - último acesso hoje</small><ChevronRight size={16} /></button>
            <button type="button"><Globe2 size={17} /> Encerrar todas as outras sessões <small>Disponível quando houver múltiplos acessos</small><ChevronRight size={16} /></button>
            <button type="button"><ShieldCheck size={17} /> Autenticação em duas etapas <em>Estrutura preparada</em><ChevronRight size={16} /></button>
          </div>
        </SettingsCard>

        <SettingsCard number="10" title="Backup e Exportação" icon={Database}>
          <AdminLine label="Exportar alunos" action="Exportar" onClick={() => notify("Exportação de alunos iniciada.")} />
          <AdminLine label="Exportar avaliações" action="Exportar" onClick={() => notify("Exportação de avaliações iniciada.")} />
          <AdminLine label="Exportar financeiro" action="Exportar" onClick={() => notify("Exportação financeira iniciada.")} />
          <AdminLine label="Backup completo" action="Realizar backup" onClick={() => notify("Backup completo iniciado.")} />
          <p>último backup: 24/05/2026 ?s 03:15</p>
        </SettingsCard>

        <SettingsCard number="11" title="Termos e Privacidade" icon={FileText}>
          <ToggleList labels={privacySettings} keys={["lgpd", "dataSharing", "examStorage"]} toggles={toggles} onToggle={toggle} />
          <AdminLine label="Politica de privacidade" action="Editar" onClick={() => notify("Editor da politica aberto.")} />
          <button className="admin-settings-wide" type="button" onClick={() => notify("Central de termos aberta.")}>Gerenciar termos</button>
        </SettingsCard>

        <SettingsCard number="12" title="Estatisticas da Conta" icon={FileText}>
          <div className="admin-stats-lines">
            <span><small>Alunos ativos</small><strong>128</strong></span>
            <span><small>Avaliações realizadas</small><strong>342</strong></span>
            <span><small>Treinos cadastrados</small><strong>1.248</strong></span>
            <span><small>Dietas cadastradas</small><strong>892</strong></span>
            <span><small>Receita total</small><strong>R$ 24.580</strong></span>
            <span><small>Dias utilizando o sistema</small><strong>187 dias</strong></span>
          </div>
          <button className="admin-settings-wide" type="button">Ver relatórios completos</button>
        </SettingsCard>

        <article className="admin-settings-danger-zone">
          <h3>13. Zona de Segurança</h3>
          <div>
            <DangerAction icon={Trash2} title="Excluir conta" text="Esta ação não poderá ser desfeita." armed={armedAction === "delete"} onClick={() => setArmedAction(armedAction === "delete" ? null : "delete")} />
            <DangerAction icon={RefreshCcw} title="Resetar sistema" text="Todos os dados serão removidos." armed={armedAction === "reset"} onClick={() => setArmedAction(armedAction === "reset" ? null : "reset")} />
          </div>
        </article>

        <article className="admin-settings-footer">
          <img src={brandImage} alt={brandName} />
          <div><p>Você está no controle do seu negócio. Cada configuração é um passo para transformar vidas e gerar resultados.</p><strong>{brandName}</strong><small>Personal Trainer</small></div>
          <img src={branding.logo_url || "/fitland-icon.svg"} alt="" />
        </article>
      </div>
    </section>
  );
}

function HeroMetric({ icon: Icon, value, label, trend }) {
  return <div className="admin-settings-hero-metric"><Icon size={31} /><strong>{value}</strong><span>{label}</span><small>{trend}</small></div>;
}

function SettingsCard({ number, title, icon: Icon, children, className = "" }) {
  return <article className={`admin-settings-card ${className}`}><h3><span>{number}.</span> {title}</h3>{children}</article>;
}

function ToggleList({ labels, keys, toggles, onToggle }) {
  return <div className="admin-toggle-list">{labels.map((label, index) => <label key={label}><span>{label}</span><button type="button" className={toggles[keys[index]] ? "on" : ""} onClick={() => onToggle(keys[index])}><i /></button></label>)}</div>;
}

function AdminLine({ label, action, onClick }) {
  return <div className="admin-settings-line"><span>{label}</span><button type="button" onClick={onClick}>{action}</button></div>;
}

function DangerAction({ icon: Icon, title, text, armed, onClick }) {
  return <button className={armed ? "armed" : ""} type="button" onClick={onClick}><Icon size={25} /><span><strong>{armed ? `Confirmar ${title.toLowerCase()}` : title}</strong><small>{text}</small></span></button>;
}
