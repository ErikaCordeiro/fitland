import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleOff, Eye, KeyRound, LockKeyhole, Moon, Pencil, Plus, Search, ShieldCheck, Sun, Trash2, Users, X } from "lucide-react";
import { apiRequest } from "../services/api.js";
import OwnerDashboard from "../components/OwnerDashboard.jsx";

const emptySummary = { personals_active: 0, personals_suspended: 0, personals_blocked: 0, students_total: 0, alerts: [] };
const statusLabel = { active: "Ativo", suspended: "Suspenso", blocked: "Bloqueado" };
const moduleOptions = [["workouts","Treinos"],["diet","Dietas"],["assessments","Avaliações"],["progress","Progresso"],["finance","Financeiro"],["agenda","Agenda"],["messages","Mensagens"],["reports","Relatórios"],["files","Arquivos"],["coach","Coach IA"],["calendar","Calendário"],["payments","Pagamentos"]];
const defaultBrand = { display_name: "", slug: "", logo_url: null, icon_url: null, profile_image_url: null, banner_url: null, primary_color: "#050505", secondary_color: "#C0C0C0", background_color: "#050505", surface_color: "#121416", accent_color: "#C0C0C0", border_color: "#34373A", text_color: "#F5F5F5", muted_text_color: "#A7ABB0", font_family: "Inter", login_subtitle: "Disciplina • Foco • Propósito", modules: Object.fromEntries(moduleOptions.map(([key])=>[key,true])) };

function Header({ title, subtitle, theme, setTheme }) {
  return <header className="owner-header"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="owner-header-actions"><button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">{theme === "dark" ? <Sun /> : <Moon />}</button><span className="owner-secure"><ShieldCheck /> Sessão protegida</span></div></header>;
}

function Avatar({ person }) { return person.avatar_url ? <img className="owner-avatar" src={person.avatar_url} alt="" /> : <span className="owner-avatar initials">{person.name.split(/\s+/).slice(0,2).map(v=>v[0]).join("")}</span>; }

function Dashboard({ onNavigate }) {
  const [data, setData] = useState(emptySummary); const [error, setError] = useState("");
  useEffect(() => { apiRequest("/owner/dashboard/summary").then(setData).catch(() => setError("Não foi possível carregar os indicadores.")); }, []);
  const cards = [["Personais ativos", data.personals_active, Users], ["Suspensos", data.personals_suspended, CircleOff], ["Bloqueados", data.personals_blocked, AlertTriangle], ["Alunos na plataforma", data.students_total, Users]];
  return <>{error && <p className="owner-alert error">{error}</p>}<section className="owner-kpis">{cards.map(([label,value,Icon])=><button key={label} onClick={() => onNavigate("personals")}><Icon/><span>{label}</span><strong>{value}</strong><small>Dados atuais do banco</small></button>)}</section><section className="owner-dashboard-grid"><article className="owner-panel"><div className="owner-panel-title"><div><p className="eyebrow">Gestão da plataforma</p><h2>Personais</h2></div><button className="owner-primary" onClick={()=>onNavigate("personals")}>Gerenciar personais</button></div><p>Cadastre, ative e acompanhe os profissionais sem acessar dados clínicos ou privados dos alunos.</p></article><article className="owner-panel"><p className="eyebrow">Alertas</p><h2>Situação administrativa</h2>{data.alerts?.length ? data.alerts.map(item=><p key={item}>{item}</p>) : <div className="owner-empty"><Check/>Nenhum alerta importante no momento.</div>}</article></section></>;
}

function PersonalModal({ item, onClose, onSaved }) {
  const editing = Boolean(item?.id);
  const [form, setForm] = useState({ name: item?.name || "", email: item?.email || "", phone: item?.phone || "", password: "", status: item?.status || "active" });
  const [brand, setBrand] = useState({ ...defaultBrand, display_name: item?.brand_name || (item?.name ? `Personal ${item.name}` : ""), slug: "" });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (editing) apiRequest(`/branding/personal/${item.id}`).then(setBrand).catch(() => {});
  }, [editing, item?.id]);

  useEffect(() => {
    if (editing || !form.name.trim()) return;
    const slug = form.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setBrand((current) => ({ ...current, display_name: `Personal ${form.name.trim()}`, slug }));
  }, [editing, form.name]);

  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = editing ? { name: form.name, email: form.email, phone: form.phone || null } : { ...form, branding: brand };
      await apiRequest(editing ? `/owner/personals/${item.id}` : "/owner/personals", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      if (editing) {
        const savedBranding = await apiRequest(`/branding/personal/${item.id}`, { method: "PUT", body: JSON.stringify(brand) });
        setBrand(savedBranding);
      }
      onSaved(); onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const uploadBrandAsset = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file || !editing) return;
    setUploading(type); setError(""); setMessage("");
    try {
      const result = await apiRequest(`/branding/personal/${item.id}/upload/${type}`, { method: "POST", body: file, headers: { "Content-Type": file.type } });
      setBrand(result.branding);
      setMessage(type === "logo" ? "Logo enviada com sucesso." : "Favicon enviado com sucesso.");
    } catch (err) { setError(err.message); setMessage(""); } finally { setUploading(""); event.target.value = ""; }
  };

  return <div className="owner-modal-backdrop" onMouseDown={onClose}>
    <form className="owner-modal owner-personalization-modal" onSubmit={save} onMouseDown={event=>event.stopPropagation()}>
      <button className="icon-close" type="button" onClick={onClose}><X/></button>
      <p className="eyebrow">{editing ? "Editar cadastro" : "Novo acesso"}</p>
      <h2>{editing ? "Personal e aplicativo" : "Cadastrar personal"}</h2>
      {error && <p className="owner-alert error">{error}</p>}
      {message && <p className="owner-alert success">{message}</p>}
      <label>Nome completo<input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label>
      <label>E-mail<input required type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label>
      <label>Telefone opcional<input value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})}/></label>
      {!editing && <><label>Senha temporária<input required minLength="10" type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/></label><label>Status<select value={form.status} onChange={event=>setForm({...form,status:event.target.value})}><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="blocked">Bloqueado</option></select></label></>}
      <fieldset className="owner-brand-fields">
        <legend>Personalização do aplicativo</legend>
        <label>Nome exibido<input required value={brand.display_name || ""} onChange={event=>setBrand({...brand,display_name:event.target.value})}/></label>
        <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={brand.slug || ""} onChange={event=>setBrand({...brand,slug:event.target.value.toLowerCase()})}/></label>
        <label>Subtítulo do login<input value={brand.login_subtitle || ""} onChange={event=>setBrand({...brand,login_subtitle:event.target.value})}/></label>
        <label>Fonte<select value={brand.font_family} onChange={event=>setBrand({...brand,font_family:event.target.value})}>{["Inter","Poppins","Montserrat","Roboto","Open Sans"].map(font=><option key={font}>{font}</option>)}</select></label>
        {editing && <div className="owner-brand-uploads"><label>{uploading === "logo" ? "Enviando..." : "Enviar logo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event=>uploadBrandAsset(event,"logo")}/></label><label>{uploading === "icon" ? "Enviando..." : "Enviar favicon"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event=>uploadBrandAsset(event,"icon")}/></label></div>}
        <div className="owner-brand-colors">{[["Fundo","background_color"],["Superfície","surface_color"],["Principal","primary_color"],["Destaque","accent_color"],["Borda","border_color"],["Texto","text_color"],["Texto secundário","muted_text_color"]].map(([label,key])=><label key={key}>{label}<input type="color" value={brand[key]} onChange={event=>setBrand({...brand,[key]:event.target.value})}/></label>)}</div>
      </fieldset>
      <fieldset className="owner-brand-fields"><legend>Recursos disponíveis</legend><div className="owner-module-grid">{moduleOptions.map(([key,label])=><label className="owner-module-toggle" key={key}><input type="checkbox" checked={brand.modules?.[key] !== false} onChange={event=>setBrand({...brand,modules:{...brand.modules,[key]:event.target.checked}})}/><span>{label}</span></label>)}</div></fieldset>
      <section className="owner-brand-preview" style={{background:brand.background_color,color:brand.text_color,borderColor:brand.border_color,fontFamily:brand.font_family}}><div>{brand.logo_url ? <img src={brand.logo_url} alt=""/> : <strong>{(brand.display_name || "P").slice(0,2).toUpperCase()}</strong>}<span>{brand.display_name || "Personal"}</span></div><p style={{color:brand.muted_text_color}}>Visualização da identidade</p><button type="button" style={{background:brand.accent_color,color:brand.background_color}}>Botão de exemplo</button></section>
      <div className="owner-modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="owner-primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button></div>
    </form>
  </div>;
}

function Personals() {
  const [items,setItems]=useState([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[search,setSearch]=useState(""),[filter,setFilter]=useState(""),[loading,setLoading]=useState(true),[modal,setModal]=useState(null),[error,setError]=useState("");
  const load=()=>{setLoading(true);apiRequest(`/owner/personals?search=${encodeURIComponent(search)}&account_status=${filter}&page=${page}&size=8`).then(d=>{setItems(d.items);setTotal(d.total);setError("")}).catch(()=>setError("Não foi possível carregar os personais.")).finally(()=>setLoading(false))};
  useEffect(load,[page,filter]);
  const status=async(item,value)=>{if(!confirm(`Confirmar alteração de ${item.name} para ${statusLabel[value]}?`))return;await apiRequest(`/owner/personals/${item.id}/${value==="active"?"activate":value==="suspended"?"suspend":"block"}`,{method:"POST",body:"{}"});load()};
  const reset=async(item)=>{if(!confirm(`Enviar um link de redefinição para ${item.name}?`))return;const data=await apiRequest(`/owner/personals/${item.id}/reset-access`,{method:"POST"});alert(data.detail)};
  const remove=async(item)=>{if(!confirm(`Excluir logicamente ${item.name}? Os ${item.student_count} alunos vinculados não serão apagados.`))return;await apiRequest(`/owner/personals/${item.id}`,{method:"DELETE"});load()};
  return <><div className="owner-toolbar"><form onSubmit={e=>{e.preventDefault();setPage(1);load()}}><Search/><input placeholder="Buscar por nome ou e-mail" value={search} onChange={e=>setSearch(e.target.value)}/></form><select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}}><option value="">Todos os status</option><option value="active">Ativos</option><option value="suspended">Suspensos</option><option value="blocked">Bloqueados</option></select><button className="owner-primary" onClick={()=>setModal({})}><Plus/> Novo personal</button></div>{error&&<p className="owner-alert error">{error}</p>}<section className="owner-table-panel">{loading?<div className="owner-skeleton">Carregando personais...</div>:items.length===0?<div className="owner-empty">Nenhum personal encontrado.</div>:<><div className="owner-table-head"><span>Personal</span><span>Alunos</span><span>Status</span><span>Cadastro</span><span>Ações</span></div>{items.map(item=><article className="owner-personal-row" key={item.id}><div className="owner-person"><Avatar person={item}/><span><strong>{item.name}</strong><small>{item.email}</small></span></div><span data-label="Alunos">{item.student_count}</span><span data-label="Status" className={`owner-status ${item.status}`}>{statusLabel[item.status]||item.status}</span><span data-label="Cadastro">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span><div className="owner-row-actions"><button title="Visualizar" onClick={()=>setModal(item)}><Eye/></button><button title="Editar" onClick={()=>setModal(item)}><Pencil/></button><button title="Redefinir acesso" onClick={()=>reset(item)}><KeyRound/></button>{item.status!=="active"&&<button title="Ativar" onClick={()=>status(item,"active")}><Check/></button>}{item.status!=="suspended"&&<button title="Suspender" onClick={()=>status(item,"suspended")}><CircleOff/></button>}{item.status!=="blocked"&&<button title="Bloquear" onClick={()=>status(item,"blocked")}><AlertTriangle/></button>}<button title="Excluir" onClick={()=>remove(item)}><Trash2/></button></div></article>)}</>}</section><div className="owner-pagination"><button disabled={page===1} onClick={()=>setPage(v=>v-1)}><ChevronLeft/></button><span>Página {page} de {Math.max(1,Math.ceil(total/8))}</span><button disabled={page>=Math.ceil(total/8)} onClick={()=>setPage(v=>v+1)}><ChevronRight/></button></div>{modal&&<PersonalModal item={modal.id?modal:null} onClose={()=>setModal(null)} onSaved={load}/>}</>;
}

function Logs(){const[items,setItems]=useState([]),[loading,setLoading]=useState(true);useEffect(()=>{apiRequest("/owner/audit-logs?size=50").then(d=>setItems(d.items)).finally(()=>setLoading(false))},[]);return <section className="owner-table-panel owner-logs">{loading?<p>Carregando logs...</p>:items.length===0?<div className="owner-empty">Nenhuma atividade administrativa registrada.</div>:items.map(log=><article key={log.id}><span className={`owner-status ${log.result}`}>{log.result}</span><div><strong>{log.action.replaceAll("_"," ")}</strong><small>{log.actor_name||"Sistema"} · {log.entity_type}</small></div><time>{new Date(log.created_at).toLocaleString("pt-BR")}</time></article>)}</section>}

function SettingsPage({session,onSession}){
 const [form,setForm]=useState({name:session.name,email:session.email,avatar_url:session.avatar_url||"",theme_preference:session.theme_preference||"auto"});
 const [message,setMessage]=useState(""); const [uploading,setUploading]=useState(false);
 const save=async e=>{e.preventDefault();const data=await apiRequest("/owner/settings",{method:"PATCH",body:JSON.stringify(form)});onSession({...session,...data});setMessage("Configurações salvas.")};
 const upload=async e=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);setMessage("");try{const data=await apiRequest("/owner/settings/avatar",{method:"POST",body:file,headers:{"Content-Type":file.type}});setForm(current=>({...current,avatar_url:data.avatar_url}));onSession({...session,avatar_url:data.avatar_url});setMessage("Foto atualizada com segurança.")}catch(error){setMessage(error.message)}finally{setUploading(false);e.target.value=""}};
 return <form className="owner-settings-grid" onSubmit={save}><section className="owner-panel"><h2>Perfil da dona</h2><div className="owner-avatar-editor"><Avatar person={{...session,avatar_url:form.avatar_url}}/><label className="owner-upload-button">{uploading?"Enviando...":"Escolher foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={uploading}/></label><small>JPG, PNG ou WebP, até 3 MB.</small></div><label>Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label></section><section className="owner-panel"><h2>Aparência</h2><label>Tema<select value={form.theme_preference} onChange={e=>setForm({...form,theme_preference:e.target.value})}><option value="auto">Automático</option><option value="dark">Escuro</option><option value="light">Claro</option></select></label><p>A preferência é aplicada em toda a área da dona.</p></section><button className="owner-primary">Salvar configurações</button>{message&&<p className="owner-alert success">{message}</p>}</form>
}

function Security({session}){const[msg,setMsg]=useState("");const submit=async e=>{e.preventDefault();try{const data=await apiRequest("/auth/password-reset/request",{method:"POST",body:JSON.stringify({email:session.email}),skipAuthRefresh:true});setMsg(data.detail)}catch(error){setMsg(error.message)}};return <div className="owner-settings-grid"><form className="owner-panel" onSubmit={submit}><h2>Alterar senha</h2><p>Por segurança, enviaremos um link temporário para o e-mail cadastrado.</p><button className="owner-primary">Enviar link por e-mail</button>{msg&&<p className="owner-alert">{msg}</p>}</form><section className="owner-panel"><LockKeyhole/><h2>Segurança da conta</h2><p>As alterações de senha exigem um token de uso único enviado por e-mail.</p></section></div>}

export default function OwnerPortal({activePage,onNavigate,session,onSession}){
 const [theme,setTheme]=useState(()=>localStorage.getItem("owner_theme")||session.theme_preference||"auto");
 useEffect(()=>{localStorage.setItem("owner_theme",theme);const resolved=theme==="auto"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):theme;document.body.classList.toggle("owner-light",resolved==="light")},[theme]);
 const meta=useMemo(()=>({dashboard:[`Bem-vinda, ${session.name.split(" ")[0]}!`,`Visão geral da sua plataforma`],personals:["Personais","Gerencie os profissionais cadastrados na plataforma."],logs:["Logs e atividades","Auditoria das ações administrativas."],settings:["Configurações","Gerencie seu perfil e suas preferências."],security:["Segurança","Proteja sua conta e altere sua senha."]}[activePage]||["Dashboard",""]),[activePage,session.name]);
 return <>{activePage!=="dashboard"&&<Header title={meta[0]} subtitle={meta[1]} theme={theme} setTheme={setTheme}/>} {activePage==="dashboard"&&<OwnerDashboard onNavigate={onNavigate} theme={theme} setTheme={setTheme}/>} {activePage==="personals"&&<Personals/>}{activePage==="logs"&&<Logs/>}{activePage==="settings"&&<SettingsPage session={session} onSession={onSession}/>} {activePage==="security"&&<Security mustChange={session.must_change_password} session={session} onSession={onSession} onNavigate={onNavigate}/>}</>;
}
