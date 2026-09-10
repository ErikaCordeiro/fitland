import React, { useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Filter,
  Image,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Pin,
  Search,
  Send,
  Smile,
  Star,
  UserRound,
  Video,
  X
} from "lucide-react";

const conversations = [
  {
    id: "conv-erika",
    name: "Erika Gomes",
    avatar: "/erika-gomes.jpeg",
    objective: "Emagrecimento e hipertrofia",
    startDate: "10/03/2024",
    nextAssessment: "28/06/2026",
    plan: "Plano Premium",
    status: "Online",
    time: "10:42",
    unread: 2,
    pinned: true,
    archived: false,
    lastMessage: "Professor, estou sentindo dor no ombro direito...",
    metrics: { adherence: 87, workouts: "3/4", water: "2,1L / 2,5L", diet: 92 },
    messages: [
      { id: "m1", from: "student", type: "text", text: "Professor, senti dor no ombro direito durante o desenvolvimento com halteres. ? normal?", time: "10:32" },
      { id: "m2", from: "personal", type: "text", text: "Bom dia, Erika! Tudo bem?\n\nPode ser sobrecarga ou execução incorreta. Vou te passar algumas orientações para ajustarmos isso.\n\nPode me enviar um vídeo da execução?", time: "10:35", read: true },
      { id: "m3", from: "student", type: "text", text: "Claro! Ja ja envio aqui.", time: "10:36" },
      { id: "m4", from: "student", type: "video", text: "video_ombro.mp4", detail: "18.4 MB", time: "10:38" },
      { id: "m5", from: "personal", type: "text", text: "Ótimo vídeo! Identifiquei alguns pontos de ajuste na postura e amplitude. Vou ajustar seu treino e te enviar um exercicio alternativo para o ombro.", time: "10:42", read: true }
    ]
  },
  {
    id: "conv-lucas",
    name: "Lucas Almeida",
    avatar: "",
    objective: "Ganho de massa",
    startDate: "04/02/2024",
    nextAssessment: "01/07/2026",
    plan: "Plano Elite",
    status: "Offline",
    time: "09:15",
    unread: 1,
    pinned: false,
    archived: false,
    lastMessage: "Posso substituir o arroz por batata doce?",
    metrics: { adherence: 78, workouts: "4/5", water: "2,0L / 3,0L", diet: 85 },
    messages: [
      { id: "l1", from: "student", type: "text", text: "Posso substituir o arroz por batata doce no almoco?", time: "09:15" }
    ]
  },
  {
    id: "conv-mariana",
    name: "Mariana Costa",
    avatar: "/erika-gomes.jpeg",
    objective: "Definição",
    startDate: "18/01/2024",
    nextAssessment: "02/07/2026",
    plan: "Plano Premium",
    status: "Offline",
    time: "Ontem",
    unread: 0,
    pinned: false,
    archived: false,
    lastMessage: "Qual a melhor hora para tomar creatina?",
    metrics: { adherence: 91, workouts: "5/5", water: "2,4L / 2,5L", diet: 94 },
    messages: [
      { id: "ma1", from: "student", type: "text", text: "Qual a melhor hora para tomar creatina?", time: "Ontem" }
    ]
  },
  {
    id: "conv-rafael",
    name: "Rafael Santos",
    avatar: "",
    objective: "Força e recomposicao",
    startDate: "11/05/2024",
    nextAssessment: "04/07/2026",
    plan: "Plano Elite",
    status: "Online",
    time: "Ontem",
    unread: 0,
    pinned: false,
    archived: true,
    lastMessage: "Sobre o treino de perna de hoje...",
    metrics: { adherence: 82, workouts: "3/4", water: "2,3L / 3,0L", diet: 79 },
    messages: [
      { id: "r1", from: "student", type: "text", text: "Sobre o treino de perna de hoje, posso reduzir uma serie?", time: "Ontem" }
    ]
  },
  {
    id: "conv-camila",
    name: "Camila Ferreira",
    avatar: "/erika-gomes.jpeg",
    objective: "Emagrecimento",
    startDate: "22/03/2024",
    nextAssessment: "05/07/2026",
    plan: "Plano Premium",
    status: "Offline",
    time: "Ontem",
    unread: 0,
    pinned: false,
    archived: false,
    lastMessage: "Atualizei minhas medidas na avaliação.",
    metrics: { adherence: 88, workouts: "4/4", water: "2,0L / 2,4L", diet: 90 },
    messages: [
      { id: "c1", from: "student", type: "document", text: "avaliação_junho.pdf", detail: "2.1 MB", time: "Ontem" }
    ]
  },
  {
    id: "conv-bruno",
    name: "Bruno Oliveira",
    avatar: "",
    objective: "Hipertrofia",
    startDate: "03/04/2024",
    nextAssessment: "12/07/2026",
    plan: "Plano Basico",
    status: "Offline",
    time: "2 dias",
    unread: 0,
    pinned: false,
    archived: false,
    lastMessage: "Não vou conseguir treinar amanhã.",
    metrics: { adherence: 72, workouts: "2/4", water: "1,8L / 2,8L", diet: 76 },
    messages: [
      { id: "b1", from: "student", type: "text", text: "Não vou conseguir treinar amanhã. Remarco para sexta?", time: "2 dias" }
    ]
  }
];

const quickActions = [
  ["Nova avaliação", FileText],
  ["Atualizar treino", UserRound],
  ["Atualizar dieta", Check],
  ["Agendar consulta", CalendarDays],
  ["Enviar arquivo", Paperclip]
];

export default function PersonalMessages({ branding }) {
  const fallbackAvatar = branding?.icon_url || branding?.logo_url || "/fitland-icon.svg";
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [mobileView, setMobileView] = useState("list");

  const visibleConversations = useMemo(() => conversations.filter((conversation) => {
    const matchesQuery = conversation.name.toLowerCase().includes(query.toLowerCase()) || conversation.lastMessage.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === "unread") return conversation.unread > 0;
    if (filter === "archived") return conversation.archived;
    return !conversation.archived;
  }), [filter, query]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) || conversations[0];
  const messages = [...selected.messages, ...(localMessages[selected.id] || [])];

  const sendMessage = () => {
    if (!draft.trim()) return;
    const message = {
      id: crypto.randomUUID(),
      from: "personal",
      type: "text",
      text: draft.trim(),
      time: "Agora",
      read: false
    };
    setLocalMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] || []), message] }));
    setDraft("");
  };

  const openConversation = (conversation) => {
    setSelectedId(conversation.id);
    setMobileView("chat");
  };

  return (
    <section className="messages-admin-page">
      <header className="messages-admin-header">
        <div>
          <h2>Mensagens</h2>
          <p>Converse com seus alunos e acompanhe todas as mensagens.</p>
        </div>
        <div className="messages-admin-tools">
          <label>
            <Search size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar mensagens..." />
          </label>
          <button type="button" aria-label="Filtros"><Filter size={20} /></button>
        </div>
      </header>

      <div className={`messages-admin-shell view-${mobileView}`}>
        <aside className="messages-conversations-panel">
          <div className="messages-panel-title">
            <div>
              <h3>Conversas <span>{conversations.length}</span></h3>
              <p>Converse com seus alunos.</p>
            </div>
            <button type="button" aria-label="Nova mensagem"><Send size={18} /></button>
          </div>

          <div className="messages-filter-tabs" role="tablist" aria-label="Filtros de conversa">
            {[
              ["all", "Todas"],
              ["unread", "Não lidas"],
              ["archived", "Arquivadas"]
            ].map(([id, label]) => (
              <button key={id} className={filter === id ? "active" : ""} type="button" onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>

          <label className="messages-side-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno..." />
          </label>

          <div className="messages-conversation-list">
            {visibleConversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`message-conversation-card ${selected.id === conversation.id ? "active" : ""}`}
                type="button"
                onClick={() => openConversation(conversation)}
              >
                <img src={conversation.avatar || fallbackAvatar} alt="" />
                <span>
                  <strong>{conversation.name}</strong>
                  <small>{conversation.lastMessage}</small>
                </span>
                <em>{conversation.time}</em>
                <div className="conversation-actions">
                  {conversation.pinned && <Pin size={13} />}
                  {conversation.archived && <Archive size={13} />}
                  {conversation.unread > 0 && <b>{conversation.unread}</b>}
                </div>
              </button>
            ))}
          </div>

          <button className="messages-new-button" type="button"><Send size={17} /> Nova mensagem</button>
        </aside>

        <main className="messages-chat-panel">
          <header className="messages-chat-header">
            <button className="messages-mobile-back" type="button" onClick={() => setMobileView("list")}>Voltar</button>
            <img src={selected.avatar || fallbackAvatar} alt="" />
            <div>
              <h3>{selected.name} <Star size={16} /></h3>
              <p><i className={selected.status === "Online" ? "online" : ""} /> {selected.status}</p>
            </div>
            <div className="messages-chat-actions">
              <button type="button" aria-label="Iniciar ligacao"><Phone size={19} /></button>
              <button type="button" aria-label="Iniciar videochamada"><Video size={19} /></button>
              <button type="button" aria-label="Mais opcoes"><MoreHorizontal size={20} /></button>
            </div>
          </header>

          <article className="messages-student-summary-inline">
            <div>
              <h4>Informações do aluno</h4>
              <p>Objetivo: {selected.objective}</p>
              <p>Início: {selected.startDate}</p>
              <p>Próxima avaliação: {selected.nextAssessment}</p>
            </div>
            <button type="button" onClick={() => setMobileView("profile")}>Ver perfil completo</button>
            <div className="messages-adherence-chip">
              <span>Aderência geral</span>
              <strong>{selected.metrics.adherence}%</strong>
            </div>
          </article>

          <div className="messages-day-divider"><span>Hoje</span></div>

          <div className="messages-thread">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} avatar={selected.avatar || fallbackAvatar} />
            ))}
          </div>

          <footer className="messages-composer">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Digite sua mensagem..." />
            <div>
              <button type="button" aria-label="Arquivo"><Paperclip size={20} /></button>
              <button type="button" aria-label="Imagem"><Image size={20} /></button>
              <button type="button" aria-label="Vídeo"><Camera size={20} /></button>
              <button type="button" aria-label="Emoji"><Smile size={20} /></button>
              <button type="button" aria-label="Audio"><Mic size={20} /></button>
              <button className="messages-send-button" type="button" onClick={sendMessage}><Send size={18} /> Enviar</button>
            </div>
          </footer>
        </main>

        <aside className="messages-profile-panel">
          <button className="messages-mobile-back" type="button" onClick={() => setMobileView("chat")}>Voltar</button>
          <img className="messages-profile-avatar" src={selected.avatar || fallbackAvatar} alt="" />
          <h3>{selected.name}</h3>
          <p>{selected.objective}</p>
          <div className="messages-profile-details">
            <span>Início<strong>{selected.startDate}</strong></span>
            <span>Próxima avaliação<strong>{selected.nextAssessment}</strong></span>
            <span>Plano atual<strong>{selected.plan}</strong></span>
          </div>

          <div className="messages-metric-grid">
            <span>Aderência geral<strong>{selected.metrics.adherence}%</strong></span>
            <span>Treinos da semana<strong>{selected.metrics.workouts}</strong></span>
            <span>água<strong>{selected.metrics.water}</strong></span>
            <span>Dieta<strong>{selected.metrics.diet}%</strong></span>
          </div>

          <div className="messages-quick-actions">
            <h4>Ações rápidas</h4>
            {quickActions.map(([label, Icon]) => (
              <button key={label} type="button" onClick={() => label === "Agendar consulta" && setScheduleOpen(true)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>

          <div className="messages-notification-card">
            <h4>Notificações</h4>
            <p>Alerta quando aluno enviar vídeo, foto, PDF, solicitar consulta ou pedir remarcação.</p>
          </div>
        </aside>
      </div>

      {scheduleOpen && <ScheduleModal student={selected} onClose={() => setScheduleOpen(false)} />}
    </section>
  );
}

function MessageBubble({ message, avatar }) {
  const own = message.from === "personal";
  return (
    <div className={`message-bubble-row ${own ? "own" : ""}`}>
      {!own && <img src={avatar} alt="" />}
      <div className={`message-bubble ${message.type}`}>
        {message.type === "video" && (
          <div className="message-vivivideo-card">
            <div><Video size={42} /></div>
            <span>{message.text}</span>
            <small>{message.detail}</small>
            <button type="button" aria-label="Baixar vídeo"><Download size={18} /></button>
          </div>
        )}
        {message.type === "document" && (
          <div className="message-file-card">
            <FileText size={28} />
            <span>{message.text}</span>
            <small>{message.detail}</small>
            <button type="button" aria-label="Baixar documento"><Download size={18} /></button>
          </div>
        )}
        {message.type === "text" && <p>{message.text}</p>}
        <time>{message.time} {own && (message.read ? <CheckCheck size={14} /> : <Check size={14} />)}</time>
      </div>
    </div>
  );
}

function ScheduleModal({ student, onClose }) {
  const [type, setType] = useState("Online");
  const [date, setDate] = useState("2026-07-15");
  const [time, setTime] = useState("19:00");

  return (
    <div className="messages-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="messages-schedule-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="messages-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <h3>Agendar consulta</h3>
        <p>Escolha data, horário e formato para {student.name}.</p>
        <div className="schedule-choice-grid">
          {['Online', 'Presencial'].map((item) => (
            <button key={item} className={type === item ? 'active' : ''} type="button" onClick={() => setType(item)}>{item}</button>
          ))}
        </div>
        <label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Horario<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        <label>Observação<textarea placeholder="Orientações, link, local ou detalhes da consulta." /></label>
        <div className="messages-schedule-summary">
          <span>Aluno<strong>{student.name}</strong></span>
          <span>Formato<strong>{type}</strong></span>
          <span>Horario<strong>{date} as {time}</strong></span>
        </div>
        <button className="messages-send-button full" type="button" onClick={onClose}>Confirmar agendamento</button>
      </div>
    </div>
  );
}
