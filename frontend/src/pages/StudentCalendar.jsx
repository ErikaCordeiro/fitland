import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  MessageCircle,
  Pencil,
  Target,
  Trophy,
  Wifi,
  X
} from "lucide-react";
import {
  calculateBestWorkoutStreak,
  calculateCurrentWorkoutStreak,
  completedWorkoutsInMonth,
  formatDateBR,
  formatMonthYear,
  getMonthlyWorkoutGoal,
  loadCalendarEvents,
  loadWorkoutHistory,
  saveCalendarEvent,
  toLocalDateKey,
  workoutEventsFromHistory
} from "../utils/activityData.js";
import { loadNotificationSettings } from "../utils/activityData.js";
import { fetchProgressionAlerts, syncWorkoutHistory } from "../services/workoutSessions.js";
import { getNextDays, getWorkoutsForDate } from "../utils/workoutSchedule.js";
import { scopedKey } from "../utils/storageScope.js";

const weekLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const availableTimes = ["08:00", "09:00", "10:00", "14:00", "15:00", "16:00", "18:00", "19:00", "20:00"];
const eventLabels = {
  workout: "Treino concluído",
  assessment: "Avaliação",
  diet: "Dieta",
  checkin: "Check-in",
  consultation: "Consulta",
  personal: "Evento"
};

function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      dateKey: toLocalDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month
    };
  });
}

export default function StudentCalendar({ student, workouts = [], onStartWorkout, branding, scope }) {
  const firstName = student?.name?.split(" ")[0] || "Aluno";
  const personalName = branding?.display_name || "Seu personal";
  const personalImage = branding?.profile_image_url || branding?.logo_url || branding?.icon_url || "/fitland-icon.svg";
  const brandLogo = branding?.logo_url || branding?.icon_url || "/fitland-icon.svg";
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => toLocalDateKey(new Date()));
  const [history, setHistory] = useState(() => loadWorkoutHistory(scope));
  const [customEvents, setCustomEvents] = useState(() => loadCalendarEvents(scope));
  const [dayDetail, setDayDetail] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attendance, setAttendance] = useState(false);
  const [serviceType, setServiceType] = useState("Online");
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTime, setSelectedTime] = useState("18:00");
  const [goalOpen, setGoalOpen] = useState(false);
  const [monthlyGoalState, setMonthlyGoalState] = useState(() => getMonthlyWorkoutGoal(scope) || 12);
  const [progressionAlerts, setProgressionAlerts] = useState([]);
  const [goalDraft, setGoalDraft] = useState(() => String(getMonthlyWorkoutGoal(scope) || 12));
  const availableDays = useMemo(() => getNextDays(7), []);

  useEffect(() => {
    setHistory(loadWorkoutHistory(scope));
    setCustomEvents(loadCalendarEvents(scope));
    setMonthlyGoalState(getMonthlyWorkoutGoal(scope) || 12);
    setGoalDraft(String(getMonthlyWorkoutGoal(scope) || 12));
  }, [scope?.personalId, scope?.userId]);

  useEffect(() => {
    const refresh = () => {
      setHistory(loadWorkoutHistory(scope));
      setCustomEvents(loadCalendarEvents(scope));
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [scope?.personalId, scope?.userId]);

  useEffect(() => {
    syncWorkoutHistory({ scope }).then(() => setHistory(loadWorkoutHistory(scope))).catch(() => {});
    fetchProgressionAlerts().then((items) => {
      setProgressionAlerts(items);
      const preferences = loadNotificationSettings();
      if (items.length && preferences.training && "Notification" in window && Notification.permission === "granted") {
        new Notification("Acompanhamento de progressão", { body: items[0].message, icon: "/pwa-icon-192.png" });
      }
    }).catch(() => {});
  }, [scope?.personalId, scope?.userId]);

  const monthDays = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const workoutEvents = useMemo(() => workoutEventsFromHistory(history), [history]);
  const scheduledWorkoutEvents = useMemo(() => monthDays.flatMap((day) => getWorkoutsForDate(workouts, day.date).map((item) => ({
    id: `scheduled-${day.dateKey}-${item.id}`,
    type: "workout",
    status: "scheduled",
    workoutId: item.id,
    dateKey: day.dateKey,
    title: item.name,
    detail: `${item.exercises?.length || 0} exercícios - ${item.duration || "Duração não informada"}`,
    time: "Treino programado"
  }))), [monthDays, workouts]);
  const events = useMemo(() => [...workoutEvents, ...scheduledWorkoutEvents, ...customEvents], [workoutEvents, scheduledWorkoutEvents, customEvents]);
  const eventsByDay = useMemo(() => {
    return events.reduce((map, event) => {
      if (!map.has(event.dateKey)) map.set(event.dateKey, []);
      map.get(event.dateKey).push(event);
      return map;
    }, new Map());
  }, [events]);

  const todayKey = toLocalDateKey(new Date());
  const currentStreak = useMemo(() => calculateCurrentWorkoutStreak(history), [history]);
  const bestStreak = useMemo(() => calculateBestWorkoutStreak(history), [history]);
  const monthWorkouts = useMemo(() => completedWorkoutsInMonth(history, monthDate), [history, monthDate]);
  const monthlyGoal = monthlyGoalState;
  const selectedEvents = eventsByDay.get(selectedKey) || [];
  const selectedDate = useMemo(() => formatDateBR(availableDays[selectedDay].date), [availableDays, selectedDay]);

  function changeMonth(delta) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function goToday() {
    const now = new Date();
    setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(toLocalDateKey(now));
  }

  function openDay(day) {
    setSelectedKey(day.dateKey);
    setDayDetail({ ...day, events: eventsByDay.get(day.dateKey) || [] });
  }

  function saveMonthlyGoal() {
    const value = Math.max(1, Math.min(60, Number(goalDraft) || 12));
    const key = scopedKey("ptf_monthly_workout_goal", scope);
    if (key) window.localStorage.setItem(key, String(value));
    setMonthlyGoalState(value);
    setGoalDraft(String(value));
    setGoalOpen(false);
  }

  function confirmSchedule() {
    const eventDate = availableDays[selectedDay].date;
    const event = {
      id: `consultation-${eventDate.getTime()}-${selectedTime}`,
      type: "consultation",
      date: eventDate.toISOString(),
      dateKey: toLocalDateKey(eventDate),
      title: `Consulta com ${personalName}`,
      detail: `${serviceType} às ${selectedTime}`,
      time: selectedTime
    };
    saveCalendarEvent(event, scope);
    setCustomEvents(loadCalendarEvents(scope));
    setScheduleOpen(false);
  }

  return (
    <section className="student-calendar-page">
      <div className="student-calendar-header">
        <div>
          <h2>Calendário</h2>
          <p>Sua consistência e compromissos reais.</p>
        </div>
        <button type="button" aria-label="Notificações"><Bell size={22} /></button>
      </div>

      <article className="calendar-streak-card">
        <div className="calendar-lion-ring">
          <img src={brandLogo} alt="" />
        </div>
        <div>
          <span>Treinos na semana</span>
          <strong>{currentStreak}</strong>
          <p>{currentStreak === 1 ? "treino concluído" : "treinos concluídos"}</p>
          <small><CalendarDays size={14} /> {monthWorkouts.length} treino(s) concluído(s) este mês</small>
        </div>
        <div className="calendar-streak-side">
          <p><Trophy size={16} /> Melhor sequência <strong>{bestStreak} {bestStreak === 1 ? "dia" : "dias"}</strong></p>
          <p><Target size={16} /> Meta do mês <strong>{monthWorkouts.length}/{monthlyGoal} treinos</strong></p>
        </div>
      </article>

      {progressionAlerts.map((alert) => (
        <article className="calendar-progression-alert" role="status" key={alert.id}>
          <Dumbbell size={20} />
          <div><strong>{alert.exercise_name}</strong><p>{alert.message}</p></div>
        </article>
      ))}

      <article className="calendar-month-card">
        <div className="calendar-card-title">
          <h3>{formatMonthYear(monthDate)}</h3>
          <div>
            <button type="button" aria-label="Màs anterior" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
            <button type="button" onClick={goToday}>Hoje</button>
            <button type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="calendar-week-labels">
          {weekLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="calendar-contribution-grid">
          {monthDays.map((day) => {
            const dayEvents = eventsByDay.get(day.dateKey) || [];
            const type = dayEvents[0]?.type || "none";
            const isToday = day.dateKey === todayKey && day.inMonth;
            const selected = day.dateKey === selectedKey;
            return (
              <button
                key={day.dateKey}
                className={`calendar-day ${type} ${day.inMonth ? "" : "muted"} ${isToday ? "today" : ""} ${selected ? "selected" : ""}`}
                type="button"
                onClick={() => openDay(day)}
              >
                <span>{day.day}</span>
                <i />
              </button>
            );
          })}
        </div>
        <div className="calendar-legend compact-legend">
          <span><i className="workout" /> Treino</span>
          <span><i className="assessment" /> Avaliação</span>
          <span><i className="diet" /> Dieta</span>
          <span><i className="checkin" /> Check-in</span>
          <span><i className="none" /> Sem atividade</span>
        </div>
      </article>

      <article className="calendar-return-card">
        <div className="calendar-card-title">
          <h3>Próximo retorno</h3>
          <button type="button" onClick={() => setScheduleOpen(true)}>Ver agenda</button>
        </div>
        <div className="calendar-return-body">
          <img className="calendar-personal-photo" src={personalImage} alt={personalName} />
          <div>
            <span>Personal</span>
            <strong>{personalName}</strong>
            <p><CalendarDays size={15} /> Sem consulta confirmada</p>
            <p><Clock size={15} /> Agende um horário</p>
            <p><Wifi size={15} /> Online ou presencial</p>
          </div>
          <img className="calendar-return-lion" src={brandLogo} alt="" />
        </div>
        <button className="calendar-metal-button" type="button" onClick={() => setScheduleOpen(true)}>
          Agendar consulta
        </button>
        <div className="calendar-return-actions">
          <button type="button" onClick={() => setAttendance(true)}>{attendance ? <Check size={17} /> : <CalendarDays size={17} />} {attendance ? "Presença confirmada" : "Confirmar presença"}</button>
          <button type="button" onClick={() => setScheduleOpen(true)}><Pencil size={17} /> Solicitar remarcação</button>
        </div>
      </article>

      <div className="student-calendar-grid">
        <article className="calendar-mini-card adherence">
          <h3>Aderência geral</h3>
          <div className="calendar-progress-ring"><strong>{monthWorkouts.length ? Math.min(100, Math.round((monthWorkouts.length / Math.max(monthlyGoal || monthWorkouts.length, 1)) * 100)) : 0}%</strong></div>
          <p>{monthWorkouts.length ? "Seu calendário já está registrando atividades reais." : "Seu progresso começará a aparecer após o primeiro treino."}</p>
        </article>

        <article className="calendar-mini-card goals editable-month-goals">
          <div className="mini-card-title-row">
            <h3>Metas do mês</h3>
            <button type="button" onClick={() => setGoalOpen(true)}><Pencil size={15} /> Editar</button>
          </div>
          <GoalLine label="Treinos" value={`${monthWorkouts.length}/${monthlyGoal}`} progress={`${Math.min(100, Math.round((monthWorkouts.length / monthlyGoal) * 100))}%`} className="workout" />
          <GoalLine label="Água" value="0/30 dias" progress="0%" className="diet" />
          <GoalLine label="Check-ins" value="0/8" progress="0%" className="assessment" />
          <p className="calendar-empty-message">Você pode ajustar sua meta de treinos sempre que precisar.</p>
        </article>

        <article className="calendar-mini-card events">
          <h3>Atividades reais</h3>
          {events.length ? events.slice(0, 4).map((event) => (
            <button key={event.id} type="button" onClick={() => openDay({ dateKey: event.dateKey, date: new Date(`${event.dateKey}T00:00:00`), day: Number(event.dateKey.slice(-2)), inMonth: true })}>
              <i className={event.type} />
              <span><strong>{event.title}</strong><small>{formatDateBR(`${event.dateKey}T00:00:00`)} - {event.detail}</small></span>
              <ChevronRight size={17} />
            </button>
          )) : <p className="calendar-empty-message">Nenhuma atividade registrada ainda.</p>}
        </article>

        <article className="calendar-mini-card message">
          <h3>Mensagem do seu Personal</h3>
          <div>
            <img src={brandLogo} alt="" />
            <span><strong>{personalName}</strong><small>Quando você concluir treinos, dieta ou avaliações, tudo aparecerá aqui com dados reais.</small></span>
          </div>
          <p>Registros atualizados em {formatDateBR(new Date())}.</p>
          <button type="button"><MessageCircle size={17} /> Enviar mensagem</button>
        </article>
      </div>

      {dayDetail && (
        <CalendarModal title={formatDateBR(`${dayDetail.dateKey}T00:00:00`)} onClose={() => setDayDetail(null)}>
          <div className="calendar-day-detail">
            {dayDetail.events.length ? dayDetail.events.map((event) => (
              <p key={event.id}><EventIcon type={event.type} /> <strong>{event.status === "scheduled" ? "Treino programado" : eventLabels[event.type] || event.title}:</strong> {event.title} - {event.detail} {event.status === "scheduled" && <button type="button" onClick={() => onStartWorkout?.(event.workoutId)}>Acessar treino</button>}</p>
            )) : <p>Nenhuma atividade registrada nesta data.</p>}
          </div>
        </CalendarModal>
      )}


      {goalOpen && (
        <CalendarModal title="Editar metas do mês" subtitle="Defina uma meta realista para acompanhar sua consistência." onClose={() => setGoalOpen(false)}>
          <div className="calendar-goal-editor">
            <label>
              <span>Meta de treinos no mês</span>
              <input type="number" min="1" max="60" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} />
            </label>
            <p>Use essa meta para acompanhar sua aderência no calendário. As atividades só contam quando o treino é finalizado.</p>
            <button className="calendar-metal-button" type="button" onClick={saveMonthlyGoal}>Salvar meta</button>
          </div>
        </CalendarModal>
      )}
      {scheduleOpen && (
        <CalendarModal title="Agendar consulta" subtitle="Escolha o melhor dia e horário para seu retorno." onClose={() => setScheduleOpen(false)}>
          <div className="schedule-personal-card">
            <img src={personalImage} alt="" />
            <div><span>Personal</span><strong>{personalName}</strong></div>
            <img src={brandLogo} alt="" />
          </div>

          <div className="schedule-type-toggle">
            {["Online", "Presencial"].map((type) => (
              <button key={type} className={serviceType === type ? "active" : ""} type="button" onClick={() => setServiceType(type)}>
                {type === "Online" ? <Wifi size={18} /> : <Target size={18} />}
                {type}
              </button>
            ))}
          </div>

          <h4>1. Selecione o dia</h4>
          <div className="schedule-day-list">
            {availableDays.map(({ weekday: week, day, month }, index) => (
              <button key={`${day}-${month}`} className={selectedDay === index ? "active" : ""} type="button" onClick={() => setSelectedDay(index)}>
                <span>{week}</span><strong>{day}</strong><small>{month}</small>
              </button>
            ))}
          </div>

          <h4>2. Horários disponíveis - {availableDays[selectedDay][1]} de Julho</h4>
          <div className="schedule-time-list">
            {availableTimes.map((time) => (
              <button key={time} className={selectedTime === time ? "active" : ""} type="button" onClick={() => setSelectedTime(time)}>
                <Clock size={18} />
                {time}
                {selectedTime === time && <Check size={18} />}
              </button>
            ))}
          </div>

          <div className="schedule-summary">
            <h4>3. Resumo da consulta</h4>
            <p><span>Data</span><strong>{selectedDate}</strong></p>
            <p><span>Horário</span><strong>{selectedTime}</strong></p>
            <p><span>Profissional</span><strong>{personalName}</strong></p>
            <p><span>Tipo de atendimento</span><strong>{serviceType}</strong></p>
          </div>

          <button className="calendar-metal-button" type="button" onClick={confirmSchedule}>Confirmar agendamento</button>
          <button className="calendar-ghost-button" type="button" onClick={() => setScheduleOpen(false)}>Cancelar</button>
          <p className="schedule-note">Ao confirmar, seu horário será salvo no calendário e aparecerá como compromisso real.</p>
        </CalendarModal>
      )}
    </section>
  );
}

function EventIcon({ type }) {
  if (type === "workout") return <Dumbbell size={17} />;
  if (type === "consultation") return <Clock size={17} />;
  return <CalendarDays size={17} />;
}

function GoalLine({ label, value, progress, className }) {
  return (
    <div className="calendar-goal-line">
      <span>{label}<strong>{value}</strong></span>
      <i><b className={className} style={{ width: progress }} /></i>
    </div>
  );
}

function CalendarModal({ title, subtitle, children, onClose }) {
  return (
    <div className="student-calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="student-calendar-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="student-calendar-modal-close" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
