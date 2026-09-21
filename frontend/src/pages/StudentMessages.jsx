import React, { useState } from "react";
import {
  Bell,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ClipboardCheck,
  Dumbbell,
  FileText,
  Image,
  Mic,
  MoreHorizontal,
  Paperclip,
  Play,
  Send,
  ShieldCheck,
  Smile,
  Utensils,
  Video,
  Wifi,
  X
} from "lucide-react";

const initialMessages = [
  { id: "m1", from: "student", type: "text", text: "Bom dia, professor! Tudo bem?\nHoje durante o desenvolvimento estou sentindo dor no ombro direito.", time: "10:31", read: true },
  { id: "m2", from: "personal", type: "text", text: "Bom dia! Tudo bem e com você\nMe envie um vídeo da execução para eu analisar melhor, por favor.", time: "10:32" },
  { id: "m3", from: "student", type: "video", text: "execucao_ombro.mp4", detail: "0:18", time: "10:33", read: true },
  { id: "m4", from: "personal", type: "text", text: "Ótimo! Identifiquei alguns pontos de ajuste na postura e na amplitude. Vou te enviar um vídeo explicando os detalhes e o que ajustar.", time: "10:35" },
  { id: "m5", from: "personal", type: "video", text: "ajuste_ombro.mp4", detail: "1:24", time: "10:36" },
  { id: "m6", from: "student", type: "text", text: "Entendi! Muito obrigada, professor. Vou ajustar e te mando outro vídeo na próxima semana.", time: "10:37", read: true }
];

const quickActions = [
  { id: "schedule", title: "Agendar consulta", text: "Escolha dia e horário", icon: CalendarDays, prompt: "Quero agendar uma consulta." },
  { id: "assessment", title: "Solicitar avaliação", text: "Pedir nova avaliação", icon: ClipboardCheck, prompt: "Gostaria de solicitar uma nova avaliação física." },
  { id: "workout", title: "Dúvida sobre treino", text: "Execucao, carga ou dor", icon: Dumbbell, prompt: "Tenho uma dúvida sobre meu treino." },
  { id: "diet", title: "Dúvida sobre dieta", text: "Refeições e substituições", icon: Utensils, prompt: "Tenho uma dúvida sobre minha dieta." }
];

const days = [
  ["TER", "15", "JUL"],
  ["QUA", "16", "JUL"],
  ["QUI", "17", "JUL"],
  ["SEX", "18", "JUL"],
  ["SAB", "19", "JUL"]
];

const times = ["08:00", "09:00", "10:00", "14:00", "16:00", "18:00", "19:00"];

export default function StudentMessages({ student, branding }) {
  return <section className="student-messages-page"><div className="tenant-data-state"><strong>Nenhuma mensagem disponível</strong><span>As conversas aparecerão quando houver integração persistida.</span></div></section>;
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const firstName = student?.name?.split(" ")[0] || "Erika";
  const personalName = branding?.display_name || "Seu personal";
  const personalImage = branding?.profile_image_url || branding?.logo_url || branding?.icon_url || "/fitland-icon.svg";

  const sendMessage = (customText) => {
    const text = (customText || draft).trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), from: "student", type: "text", text, time: "Agora", read: false }
    ]);
    setDraft("");
  };

  const handleQuickAction = (action) => {
    if (action.id === "schedule") {
      setScheduleOpen(true);
      return;
    }
    setDraft(`Olá, ${personalName}! ${action.prompt}`);
  };

  return (
    <section className="student-messages-page">
      <header className="student-messages-header">
        <div>
          <h2>Mensagens</h2>
          <p>Converse diretamente com seu personal.</p>
        </div>
        <div>
          <button type="button" aria-label="Notificações"><Bell size={21} /></button>
          <button type="button" aria-label="Opcoes"><MoreHorizontal size={22} /></button>
        </div>
      </header>

      <article className="student-personal-card">
        <div className="student-personal-avatar-wrap">
          <img src={personalImage} alt={personalName} />
          <i />
        </div>
        <div>
          <span>Personal</span>
          <h3>{personalName} <ShieldCheck size={19} /></h3>
          <p><i /> Online</p>
          <small>Disciplina • Foco • Propósito</small>
        </div>
        <img className="student-personal-lion" src={branding?.logo_url || "/fitland-icon.svg"} alt="" />
      </article>

      <div className="student-message-shortcuts">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.id} type="button" onClick={() => handleQuickAction(action)}>
              <Icon size={24} />
              <span><strong>{action.title}</strong><small>{action.text}</small></span>
            </button>
          );
        })}
      </div>

      <article className="student-chat-card">
        <div className="student-chat-day"><span>Hoje, 24 de Junho</span></div>
        <div className="student-chat-thread">
          {messages.map((message) => (
            <StudentMessage key={message.id} message={message} personalName={personalName} personalImage={personalImage} />
          ))}
        </div>
        <footer className="student-message-composer">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Digite sua mensagem para ${personalName}, ${firstName}...`}
          />
          <div>
            <button type="button" aria-label="Arquivo"><Paperclip size={21} /></button>
            <button type="button" aria-label="Foto"><Image size={21} /></button>
            <button type="button" aria-label="Vídeo"><Camera size={21} /></button>
            <button type="button" aria-label="Audio"><Mic size={21} /></button>
            <button type="button" aria-label="Emoji"><Smile size={21} /></button>
            <button className="student-message-send" type="button" onClick={() => sendMessage()}><Send size={18} /> Enviar</button>
          </div>
        </footer>
      </article>

      {scheduleOpen && <StudentScheduleModal onClose={() => setScheduleOpen(false)} onConfirm={() => {
        setScheduleOpen(false);
        sendMessage(`Olá, ${personalName}! Confirmei uma consulta pelo app. Pode verificar na sua agenda?`);
      }} personalName={personalName} personalImage={personalImage} />}
    </section>
  );
}

function StudentMessage({ message, personalName, personalImage }) {
  const own = message.from === "student";
  return (
    <div className={`student-message-row ${own ? "own" : ""}`}>
      {!own && <img src={personalImage} alt={personalName} />}
      <div className={`student-message-bubble ${message.type}`}>
        {message.type === "text" && <p>{message.text}</p>}
        {message.type === "video" && (
          <div className="student-message-video">
            <div><Play size={40} /></div>
            <span><Video size={16} /> {message.detail}</span>
            <small>{message.text}</small>
          </div>
        )}
        {message.type === "document" && (
          <div className="student-message-file"><FileText size={28} /> <span>{message.text}</span></div>
        )}
        <time>{message.time} {own && (message.read ? <CheckCheck size={14} /> : <Check size={14} />)}</time>
      </div>
    </div>
  );
}

function StudentScheduleModal({ onClose, onConfirm, personalName, personalImage }) {
  const [type, setType] = useState("Online");
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("18:00");

  return (
    <div className="student-message-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="student-message-schedule" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="student-message-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <h3>Agendar consulta</h3>
        <p>Escolha o melhor dia e horário para falar com {personalName}.</p>

        <div className="student-schedule-personal">
          <img src={personalImage} alt="" />
          <div><span>Personal</span><strong>{personalName}</strong><small>Online agora</small></div>
          <Wifi size={22} />
        </div>

        <div className="student-schedule-type">
          {["Online", "Presencial"].map((item) => (
            <button key={item} className={type === item ? "active" : ""} type="button" onClick={() => setType(item)}>{item}</button>
          ))}
        </div>

        <h4>Selecione o dia</h4>
        <div className="student-schedule-days">
          {days.map(([week, date, month], index) => (
            <button key={date} className={day === index ? "active" : ""} type="button" onClick={() => setDay(index)}>
              <span>{week}</span><strong>{date}</strong><small>{month}</small>
            </button>
          ))}
        </div>

        <h4>Horarios disponiveis</h4>
        <div className="student-schedule-times">
          {times.map((item) => (
            <button key={item} className={time === item ? "active" : ""} type="button" onClick={() => setTime(item)}>
              {item}{time === item && <Check size={17} />}
            </button>
          ))}
        </div>

        <div className="student-schedule-summary">
          <span>Data<strong>{days[day][1]}/07/2026</strong></span>
          <span>Horario<strong>{time}</strong></span>
          <span>Atendimento<strong>{type}</strong></span>
        </div>

        <button className="student-message-confirm" type="button" onClick={onConfirm}>Confirmar consulta</button>
      </div>
    </div>
  );
}
