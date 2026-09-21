import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Filter,
  Plus,
  Sparkles,
  Users,
  X
} from "lucide-react";

const days = [
  { key: "seg", label: "Seg 21" },
  { key: "ter", label: "Ter 22" },
  { key: "qua", label: "Qua 23", current: true },
  { key: "qui", label: "Qui 24" },
  { key: "sex", label: "Sex 25" }
];

const hours = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

const events = [
  { id: 1, day: "seg", time: "07:00", student: "Erika Gomes", type: "Treino", objective: "Hipertrofia", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Inferiores com foco em progressao.", row: 0 },
  { id: 2, day: "seg", time: "09:00", student: "Lucas Martins", type: "Avaliação", objective: "Definição", duration: "45 min", location: "Sala de avaliação", status: "Confirmado", notes: "Revisar medidas e fotos.", row: 2 },
  { id: 3, day: "seg", time: "14:00", student: "Amanda Lima", type: "Treino", objective: "Emagrecimento", duration: "60 min", location: "Studio", status: "Pendente", notes: "Treino metabolico leve.", row: 7 },
  { id: 4, day: "ter", time: "08:00", student: "Patricia Alves", type: "Treino", objective: "Força", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Superiores A.", row: 1 },
  { id: 5, day: "ter", time: "10:00", student: "Rafael Souza", type: "Avaliação", objective: "Recomposição", duration: "45 min", location: "Sala de avaliação", status: "Confirmado", notes: "Nova bioimpedância.", row: 3 },
  { id: 6, day: "qua", time: "07:30", student: "Juliana Costa", type: "Treino", objective: "Performance", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Costas e biceps.", row: 0.5 },
  { id: 7, day: "qua", time: "09:30", student: "Lucas Martins", type: "Avaliação", objective: "Definição", duration: "45 min", location: "Sala de avaliação", status: "Confirmado", notes: "Conferência de dobras.", row: 2.5 },
  { id: 8, day: "qua", time: "11:30", student: "Equipe", type: "Reunião", objective: "Operação", duration: "30 min", location: "Online", status: "Confirmado", notes: "Ajustes de agenda.", row: 4.5 },
  { id: 9, day: "qua", time: "14:00", student: "Amanda Lima", type: "Dieta", objective: "Emagrecimento", duration: "30 min", location: "Online", status: "Pendente", notes: "Ajustar marmitas.", row: 7 },
  { id: 10, day: "qua", time: "17:00", student: "Erika Gomes", type: "Treino", objective: "Hipertrofia", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Peito e ombros.", row: 10 },
  { id: 11, day: "qui", time: "08:00", student: "Gabriel Ferreira", type: "Avaliação", objective: "Ganho de massa", duration: "45 min", location: "Sala de avaliação", status: "Confirmado", notes: "Reavaliar massa magra.", row: 1 },
  { id: 12, day: "qui", time: "10:00", student: "Erika Gomes", type: "Treino", objective: "Hipertrofia", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Glúteos e posteriores.", row: 3 },
  { id: 13, day: "qui", time: "13:30", student: "Rafael Souza", type: "Dieta", objective: "Recomposição", duration: "30 min", location: "Online", status: "Pendente", notes: "Plano alimentar semanal.", row: 6.5 },
  { id: 14, day: "sex", time: "07:00", student: "Amanda Lima", type: "Treino", objective: "Emagrecimento", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Full body.", row: 0 },
  { id: 15, day: "sex", time: "09:00", student: "Rafael Souza", type: "Avaliação", objective: "Recomposição", duration: "45 min", location: "Sala de avaliação", status: "Confirmado", notes: "Fotos comparativas.", row: 2 },
  { id: 16, day: "sex", time: "11:30", student: "Juliana Costa", type: "Dieta", objective: "Performance", duration: "30 min", location: "Online", status: "Confirmado", notes: "Pre-treino e hidratação.", row: 4.5 },
  { id: 17, day: "sex", time: "15:00", student: "Lucas Martins", type: "Treino", objective: "Definição", duration: "60 min", location: "Studio", status: "Confirmado", notes: "Cardio final.", row: 8 }
];

const typeClass = {
  Treino: "workout",
  Avaliação: "assessment",
  Dieta: "diet",
  Consulta: "consult",
  "Reunião": "meeting"
};

export default function PersonalAgenda({ students }) {
  const [mode, setMode] = useState("week");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const nextEvents = useMemo(() => events.slice(0, 5), []);

  return <section className="agenda-page"><div className="tenant-data-state"><strong>Nenhum compromisso cadastrado</strong><span>A agenda ficará disponível quando houver eventos reais.</span></div></section>;

  return (
    <section className="agenda-page">
      <div className="agenda-header">
        <div>
          <span className="eyebrow">Produtividade premium</span>
          <h2>Agenda</h2>
          <p>Organize seus alunos e compromissos.</p>
        </div>
        <div className="agenda-actions">
          <button type="button"><CalendarDays size={17} /> 21 - 27 de Junho, 2025</button>
          <div className="agenda-view-toggle" role="group" aria-label="Visualização da agenda">
            <button className={mode === "week" ? "active" : ""} type="button" onClick={() => setMode("week")}>Semana</button>
            <button className={mode === "month" ? "active" : ""} type="button" onClick={() => setMode("month")}>Mês</button>
          </div>
          <button type="button"><Filter size={17} /> Filtros</button>
          <button type="button" className="agenda-primary-action" onClick={() => setNewOpen(true)}><Plus size={18} /> Novo compromisso</button>
        </div>
      </div>

      <div className="agenda-summary-grid">
        <SummaryCard icon={CalendarDays} title="Hoje" value="8" detail="compromissos" />
        <SummaryCard icon={Users} title="Alunos agendados" value="24" detail="hoje" />
        <SummaryCard icon={ClipboardCheck} title="Avaliações" value="3" detail="agendadas" />
        <SummaryCard icon={Dumbbell} title="Treinos marcados" value="18" detail="hoje" />
      </div>

      <div className="agenda-content-grid">
        <article className="agenda-calendar-card">
          <div className="agenda-week-head">
            <span />
            {days.map((day) => (
              <strong key={day.key} className={day.current ? "current" : ""}>{day.label}</strong>
            ))}
          </div>
          <div className="agenda-calendar-body">
            <div className="agenda-hours">
              {hours.map((hour) => <span key={hour}>{hour}</span>)}
            </div>
            <div className="agenda-day-grid">
              {days.map((day) => (
                <div key={day.key} className="agenda-day-column">
                  {events.filter((event) => event.day === day.key).map((event) => (
                    <button
                      key={event.id}
                      className={`agenda-event ${typeClass[event.type] || "consult"}`}
                      style={{ top: `${event.row * 56 + 8}px` }}
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <span>{event.time}</span>
                      <strong>{event.student}</strong>
                      <small>{event.type}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="agenda-side-panel">
          <article className="agenda-side-card">
            <div className="agenda-side-title">
              <h3>Próximos compromissos</h3>
              <button type="button" onClick={() => setSelectedEvent(nextEvents[0])}>Ver todos</button>
            </div>
            <div className="agenda-next-list">
              {nextEvents.map((event) => (
                <button key={event.id} type="button" onClick={() => setSelectedEvent(event)}>
                  <span>{event.time}</span>
                  <div>
                    <strong>{event.student}</strong>
                    <small>{event.type}</small>
                  </div>
                  <ChevronTiny />
                </button>
              ))}
            </div>
          </article>

          <article className="agenda-side-card agenda-coach-card">
            <div className="agenda-side-title">
              <h3>Coach IA</h3>
              <span>BETA</span>
            </div>
            <div className="agenda-coach-orb"><Sparkles size={30} /></div>
            <ul>
              <li>Você possui 3 avaliações hoje.</li>
              <li>2 alunos ainda não confirmaram presença.</li>
              <li>Sua agenda esta com 87% de ocupacao.</li>
            </ul>
            <button type="button" className="agenda-metal-button" onClick={() => setInsightsOpen(true)}>Ver insights completos</button>
          </article>
        </aside>
      </div>

      <button className="agenda-floating-action" type="button" onClick={() => setNewOpen(true)} aria-label="Novo compromisso">
        <Plus size={22} />
      </button>

      {selectedEvent && (
        <AgendaModal title={selectedEvent.student} onClose={() => setSelectedEvent(null)}>
          <div className="agenda-detail-grid">
            <span>Tipo <strong>{selectedEvent.type}</strong></span>
            <span>Horario <strong>{selectedEvent.time}</strong></span>
            <span>Objetivo <strong>{selectedEvent.objective}</strong></span>
            <span>Duracao <strong>{selectedEvent.duration}</strong></span>
            <span>Local <strong>{selectedEvent.location}</strong></span>
            <span>Status <strong>{selectedEvent.status}</strong></span>
          </div>
          <p>{selectedEvent.notes}</p>
          <button type="button" className="agenda-metal-button" onClick={() => setSelectedEvent(null)}>Concluir</button>
        </AgendaModal>
      )}

      {newOpen && (
        <AgendaModal title="Novo compromisso" onClose={() => setNewOpen(false)}>
          <form className="agenda-form" onSubmit={(event) => { event.preventDefault(); setNewOpen(false); }}>
            <label>Aluno<select defaultValue={students?.[0]?.name || "Erika Gomes"}><option>{students?.[0]?.name || "Erika Gomes"}</option><option>Amanda Lima</option><option>Gabriel Ferreira</option></select></label>
            <label>Tipo<select defaultValue="Treino"><option>Treino</option><option>Avaliação</option><option>Dieta</option><option>Reunião</option><option>Consulta</option></select></label>
            <label>Data<input type="date" defaultValue="2025-06-23" /></label>
            <label>Horario<input type="time" defaultValue="09:30" /></label>
            <label>Duracao<input type="text" defaultValue="60 min" /></label>
            <label>Recorrencia<select defaultValue="Sem recorrencia"><option>Sem recorrencia</option><option>Semanal</option><option>Mensal</option></select></label>
            <label className="wide">Observação<textarea defaultValue="Ajustar conforme objetivo do aluno." /></label>
            <button type="submit" className="agenda-metal-button">Salvar compromisso</button>
          </form>
        </AgendaModal>
      )}

      {insightsOpen && (
        <AgendaModal title="Insights da agenda" onClose={() => setInsightsOpen(false)}>
          <ul className="agenda-insight-list">
            <li><CheckCircle2 size={17} /> Melhor janela livre: quinta as 12:00.</li>
            <li><CheckCircle2 size={17} /> Concentre avaliações pela manhã para reduzir pausas.</li>
            <li><CheckCircle2 size={17} /> Erika e Amanda podem alternar horários sem conflito.</li>
          </ul>
          <button type="button" className="agenda-metal-button" onClick={() => setInsightsOpen(false)}>Aplicar sugestão</button>
        </AgendaModal>
      )}
    </section>
  );
}

function SummaryCard({ icon: Icon, title, value, detail }) {
  return (
    <article className="agenda-summary-card">
      <span><Icon size={24} /></span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function AgendaModal({ title, children, onClose }) {
  return (
    <div className="agenda-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="agenda-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="agenda-modal-close" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">Agenda premium</span>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ChevronTiny() {
  return <span className="agenda-chevron">&gt;</span>;
}
