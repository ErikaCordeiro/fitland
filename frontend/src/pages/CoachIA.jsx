import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { apiRequest } from "../services/api.js";

export default function CoachIA({ onClose, branding, modules = {} }) {
  const availableTopics = useMemo(() => [
    modules.workouts && "treino",
    modules.progress && "progresso",
    modules.calendar && "agenda",
    modules.diet && "plano alimentar",
  ].filter(Boolean), [modules]);
  const [messages, setMessages] = useState(() => [{
    from: "coach",
    text: availableTopics.length
      ? `Oi! Posso ajudar você a consultar ${availableTopics.join(", ")}.`
      : "Oi! Posso ajudar com as informações disponíveis no seu Fitland.",
  }]);
  const [input, setInput] = useState("");
  const [contextToken, setContextToken] = useState(null);
  const [sending, setSending] = useState(false);
  const requestInFlight = useRef(false);
  const personalName = branding?.display_name || "seu Personal";
  const quickActions = useMemo(() => [
    modules.workouts && ["Meu treino de hoje", "Qual meu treino hoje?"],
    modules.progress && ["Meu progresso", "Como está meu progresso?"],
    modules.diet && ["Minha dieta", "Qual é meu plano alimentar?"],
    modules.messages && ["Falar com meu Personal", "Quero falar com meu Personal"],
  ].filter(Boolean), [modules]);

  const sendMessage = async (value = input) => {
    const clean = value.trim();
    if (!clean || requestInFlight.current) return;
    requestInFlight.current = true;
    setSending(true);
    setInput("");
    setMessages((current) => [...current, { from: "user", text: clean }]);
    try {
      const result = await apiRequest("/coach/messages", { method: "POST", body: JSON.stringify({ message: clean, context_token: contextToken }), timeoutMs: 12000 });
      setContextToken(result.context_token);
      setMessages((current) => [...current, { from: "coach", text: result.message, options: result.options || [], escalation: result.escalation }]);
    } catch (error) {
      setMessages((current) => [...current, { from: "coach", error: true, text: error.message || "Não foi possível consultar o Coach agora." }]);
    } finally {
      requestInFlight.current = false;
      setSending(false);
    }
  };

  const escalate = async (token) => {
    if (!token || requestInFlight.current) return;
    requestInFlight.current = true;
    setSending(true);
    try {
      const result = await apiRequest("/coach/escalations", { method: "POST", body: JSON.stringify({ token }) });
      setMessages((current) => [...current, { from: "coach", text: result.message }]);
    } catch (error) {
      setMessages((current) => [...current, { from: "coach", error: true, text: error.message || `Não consegui encaminhar pelo Fitland. Entre em contato diretamente com ${personalName}.` }]);
    } finally {
      requestInFlight.current = false;
      setSending(false);
    }
  };

  return <section className="coach-page" aria-labelledby="coach-title">
    <header className="coach-page-header"><button type="button" onClick={onClose} aria-label="Voltar"><ArrowLeft size={20} /></button><div><p className="eyebrow">Coach Fitland</p><h2 id="coach-title">Seu assistente de treino</h2><span>Respostas baseadas nos seus dados registrados.</span></div><Bot size={28} aria-hidden="true" /></header>
    <div className="coach-conversation" role="log" aria-live="polite">
      {messages.map((message, index) => <article key={`${message.from}-${index}`} className={`coach-bubble ${message.from} ${message.error ? "error" : ""}`}>
        {message.from === "coach" && <Bot size={18} aria-hidden="true" />}<div><p>{message.text}</p>
          {message.options?.length > 0 && <div className="coach-inline-actions">{message.options.map((option) => <button key={option.message} type="button" onClick={() => sendMessage(option.message)}>{option.label}</button>)}</div>}
          {message.escalation && <div className="coach-escalation-action">{message.escalation.available ? <button type="button" onClick={() => escalate(message.escalation.token)}><MessageCircle size={17} />Encaminhar ao Personal</button> : <span>Mensagens não estão disponíveis. Entre em contato diretamente com seu Personal.</span>}</div>}
        </div>
      </article>)}
      {sending && <article className="coach-bubble coach loading"><LoaderCircle className="spin" size={18} /><p>Consultando seus dados...</p></article>}
    </div>
    {messages.length === 1 && quickActions.length > 0 && <div className="coach-quick-actions" aria-label="Sugestões rápidas">{quickActions.map(([label, value]) => <button key={label} type="button" onClick={() => sendMessage(value)}>{label}</button>)}</div>}
    <form className="coach-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><label htmlFor="coach-message">Pergunte ao Coach Fitland</label><div><textarea id="coach-message" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} rows={2} placeholder="Ex.: Qual meu treino de hoje?" disabled={sending} /><button type="submit" disabled={sending || !input.trim()} aria-label="Enviar mensagem"><Send size={19} /></button></div><small>O Coach consulta dados do Fitland e não substitui orientação médica ou do seu Personal.</small></form>
  </section>;
}
