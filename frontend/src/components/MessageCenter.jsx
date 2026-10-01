import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, MessageCircle, Search, Send } from "lucide-react";
import { apiRequest } from "../services/api.js";

const MAX_LENGTH = 4000;
const formatDate = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function MessageCenter({ mode, branding, onUnreadChange }) {
  const [conversations, setConversations] = useState([]), [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]), [nextBefore, setNextBefore] = useState(null);
  const [query, setQuery] = useState(""), [draft, setDraft] = useState(""), [error, setError] = useState("");
  const [status, setStatus] = useState("loading"), [threadStatus, setThreadStatus] = useState("idle");
  const [sending, setSending] = useState(false), [mobileThread, setMobileThread] = useState(false);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const rows = await apiRequest("/messages/conversations");
      setConversations(rows); setStatus("success");
      onUnreadChange?.(rows.reduce((sum, item) => sum + item.unread_count, 0));
      setSelected((current) => current ? rows.find((item) => item.student_id === current.student_id) || rows[0] || null : rows[0] || null);
    } catch (err) { if (!silent) { setStatus("error"); setError(err.message); } }
  }, [onUnreadChange]);

  const loadMessages = useCallback(async (conversation, before = null, prepend = false) => {
    if (!conversation?.id) { setMessages([]); setNextBefore(null); setThreadStatus("success"); return; }
    setThreadStatus("loading");
    try {
      const page = await apiRequest(`/messages/conversations/${conversation.id}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`);
      setMessages((current) => prepend ? [...page.items, ...current] : page.items); setNextBefore(page.next_before);
      await apiRequest(`/messages/conversations/${conversation.id}/read`, { method: "POST" });
      setThreadStatus("success");
      setConversations((current) => current.map((item) => item.student_id === conversation.student_id ? { ...item, unread_count: 0 } : item));
      loadConversations(true);
    } catch (err) { setThreadStatus("error"); setError(err.message); }
  }, [loadConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (selected) loadMessages(selected); }, [selected?.id, selected?.student_id]);
  useEffect(() => { const timer = window.setInterval(() => loadConversations(true), 20000); return () => window.clearInterval(timer); }, [loadConversations]);
  const visible = useMemo(() => conversations.filter((item) => item.student_name.toLowerCase().includes(query.trim().toLowerCase())), [conversations, query]);

  const send = async () => {
    const body = draft.trim(); if (!body || sending || !selected) return;
    setSending(true); setError("");
    try {
      let conversation = selected;
      if (!conversation.id) {
        conversation = await apiRequest("/messages/conversations", { method: "POST", body: JSON.stringify(mode === "personal" ? { student_id: conversation.student_id } : {}) });
        setSelected(conversation);
      }
      const message = await apiRequest(`/messages/conversations/${conversation.id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      setMessages((current) => [...current, message]); setDraft(""); await loadConversations(true);
    } catch (err) { setError(err.message || "Não foi possível enviar. Tente novamente."); }
    finally { setSending(false); }
  };

  if (status === "loading") return <section className="message-center-state"><LoaderCircle className="spin" /><span>Carregando mensagens...</span></section>;
  if (status === "error") return <section className="message-center-state error" role="alert"><strong>Não foi possível carregar as mensagens</strong><span>{error}</span><button type="button" onClick={() => loadConversations()}>Tentar novamente</button></section>;
  return <section className={`message-center message-center-${mode} ${mobileThread ? "mobile-thread-open" : ""}`}>
    {mode === "personal" && <aside className="message-conversation-pane"><header><span className="eyebrow">Comunicação</span><h2>Mensagens</h2></header><label className="message-search"><Search size={18} /><span className="sr-only">Buscar aluno</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar aluno..." /></label><div className="message-conversation-list">
      {visible.length === 0 && <Empty title="Nenhuma conversa ainda" text="Os alunos aparecem aqui quando estão cadastrados." />}
      {visible.map((item) => <button type="button" key={item.student_id} className={selected?.student_id === item.student_id ? "active" : ""} onClick={() => { setSelected(item); setMobileThread(true); }}><Avatar name={item.student_name} /><span className="message-conversation-copy"><strong>{item.student_name}</strong><small>{item.last_message || "Iniciar conversa"}</small></span><span className="message-conversation-meta">{item.last_message_at && <time>{formatDate(item.last_message_at)}</time>}{item.unread_count > 0 && <b aria-label={`${item.unread_count} mensagens não lidas`}>{item.unread_count}</b>}</span></button>)}
    </div></aside>}
    <main className="message-thread-pane">{!selected ? <Empty title={mode === "student" ? "Nenhuma mensagem ainda" : "Selecione uma conversa"} text={mode === "student" ? "Quando você enviar uma mensagem, ela aparecerá aqui." : "Escolha um aluno para começar."} /> : <>
      <header className="message-thread-header"><button className="message-back" type="button" onClick={() => setMobileThread(false)} aria-label="Voltar às conversas"><ArrowLeft /></button><Avatar name={selected.student_name} /><div><small>{mode === "student" ? "Personal" : "Aluno"}</small><h2>{mode === "student" ? branding?.display_name || "Meu Personal" : selected.student_name}</h2></div></header>
      <div className="message-thread" aria-live="polite">{nextBefore && <button className="message-load-earlier" type="button" onClick={() => loadMessages(selected, nextBefore, true)}>Carregar anteriores</button>}{threadStatus === "loading" && messages.length === 0 && <Empty loading title="Carregando conversa..." />}{threadStatus === "success" && messages.length === 0 && <Empty title="Nenhuma mensagem ainda" text="Envie a primeira mensagem desta conversa." />}{messages.map((message) => { const own = message.sender_role === mode; return <article key={message.id} className={`message-row ${own ? "sent" : "received"}`} aria-label={own ? "Mensagem enviada" : "Mensagem recebida"}><div><span className="message-direction">{own ? "Você" : mode === "personal" ? selected.student_name : "Personal"}</span><p>{message.body}</p><time>{formatDate(message.created_at)}</time></div></article>; })}</div>
      <form className="message-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>{error && <p className="message-send-error" role="alert">{error}</p>}<label htmlFor="message-body">Digite uma mensagem</label><div><textarea id="message-body" value={draft} maxLength={MAX_LENGTH} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Digite uma mensagem..." rows="2" /><button type="submit" disabled={!draft.trim() || sending}><Send size={18} />{sending ? "Enviando..." : "Enviar"}</button></div><small>{draft.length}/{MAX_LENGTH}</small></form>
    </>}</main>
  </section>;
}

function Avatar({ name }) { return <span className="message-avatar" aria-hidden="true">{(name || "M").slice(0, 2).toUpperCase()}</span>; }
function Empty({ title, text, loading }) { return <div className="message-empty">{loading ? <LoaderCircle className="spin" /> : <MessageCircle />}<strong>{title}</strong>{text && <span>{text}</span>}</div>; }
