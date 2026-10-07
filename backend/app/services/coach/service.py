from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select

from app.models.audit_log import AuditLog
from app.schemas.coach import CoachEscalation, CoachIntent, CoachMessageResponse, CoachOption
from app.services.coach.classifier import IntentClassifier
from app.services.coach.classifier import normalize_text
from app.services.coach.context import decode_context, encode_context
from app.services.coach.data_resolver import CoachDataResolver
from app.services.coach.escalation import escalation_token
from app.services.coach.responses import response_variant


RATE_LIMIT_PER_MINUTE = 30


class CoachService:
    def __init__(self, db, user):
        self.db = db
        self.user = user
        self.data = CoachDataResolver(db, user)
        self.classifier = IntentClassifier()

    def respond(self, payload) -> CoachMessageResponse:
        self._rate_limit()
        context = decode_context(payload.context_token, self.user.id)
        classification = self.classifier.classify(payload.message, has_exercise_context=bool(context.get("last_exercise_id")))
        if normalize_text(payload.message) in {"sim", "pode", "claro", "mostrar", "mostra"} and context.get("last_intent") == CoachIntent.TODAY_WORKOUT.value:
            classification = classification.__class__(CoachIntent.WORKOUT_EXERCISES, "match", normalize_text(payload.message))
        self._audit("coach_message_received", details={"length": len(payload.message)})
        message, updates, options, escalation = self._resolve(classification.intent, classification.confidence, payload.message, context)
        action = "coach_fallback" if classification.intent == CoachIntent.UNKNOWN else "coach_intent_resolved"
        self._audit(action, result="fallback" if action == "coach_fallback" else "success", details={"intent": classification.intent.value, "confidence": classification.confidence})
        if escalation is not None:
            self._audit(
                "coach_escalation_requested",
                result="available" if escalation.available else "unavailable",
                details={"intent": classification.intent.value},
            )
        context.update(updates)
        context["last_intent"] = classification.intent.value
        self.db.commit()
        return CoachMessageResponse(
            intent=classification.intent,
            confidence=classification.confidence,
            message=message,
            context_token=encode_context(self.user.id, context),
            options=options,
            escalation=escalation,
        )

    def _resolve(self, intent, confidence, text, context):
        seed = str(self.user.id)
        empty = ({}, [], None)
        if intent == CoachIntent.GREETING:
            return response_variant("greeting", seed), *empty
        if intent == CoachIntent.HELP:
            return response_variant("help", seed), *empty
        if intent == CoachIntent.PAIN_OR_INJURY:
            return response_variant("pain", seed), {}, [], self._escalation(text, intent.value)
        if intent == CoachIntent.CHANGE_WORKOUT_REQUEST:
            return response_variant("change", seed), {}, [], self._escalation(text, intent.value)
        if intent == CoachIntent.CONTACT_PERSONAL:
            return "Posso encaminhar sua mensagem ao seu Personal após sua confirmação.", {}, [], self._escalation(text, intent.value)
        if intent == CoachIntent.UNKNOWN:
            key = "ambiguous_weight" if confidence == "ambiguous" else "unknown"
            options = [CoachOption(label="Meu peso atual", message="Qual é meu peso atual?"), CoachOption(label="Carga de exercício", message="Qual carga do exercício?")] if confidence == "ambiguous" else []
            return response_variant(key, seed), {}, options, self._escalation(text, intent.value)
        if intent in {CoachIntent.TODAY_WORKOUT, CoachIntent.WORKOUT_EXERCISES}:
            workout = self.data.today_workout() if intent == CoachIntent.TODAY_WORKOUT else self.data.workout_from_context(context) or self.data.today_workout()
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            if not workout:
                return response_variant("no_workout", seed), *empty
            updates = {"last_workout_id": workout.id}
            if intent == CoachIntent.TODAY_WORKOUT:
                return f"Hoje você tem {workout.name}.", updates, [CoachOption(label="Ver exercícios", message="Quais exercícios?")], None
            if not workout.exercises:
                return f"O treino {workout.name} ainda não possui exercícios cadastrados.", updates, [], None
            lines = [f"• {item.exercise.name} — {item.sets} séries de {item.repetitions}" for item in workout.exercises]
            return f"Seu treino {workout.name} tem:\n" + "\n".join(lines), updates, [], None
        if intent in {CoachIntent.EXERCISE_SETS, CoachIntent.EXERCISE_REPS, CoachIntent.EXERCISE_LOAD, CoachIntent.EXERCISE_REST, CoachIntent.LAST_EXERCISE_PERFORMANCE}:
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            exercise, matches = self.data.resolve_exercise(text, context)
            if not exercise and len(matches) > 1:
                prompts = {
                    CoachIntent.EXERCISE_SETS: "Quantas séries de",
                    CoachIntent.EXERCISE_REPS: "Quantas repetições de",
                    CoachIntent.EXERCISE_LOAD: "Qual carga de",
                    CoachIntent.EXERCISE_REST: "Qual intervalo de",
                    CoachIntent.LAST_EXERCISE_PERFORMANCE: "Quanto fiz na última vez em",
                }
                options = [CoachOption(label=row.exercise.name, message=f"{prompts[intent]} {row.exercise.name}?") for row in matches[:6]]
                return "Encontrei mais de um exercício possível. Qual deles você quer consultar?", {}, options, None
            if not exercise:
                return response_variant("no_exercise", seed), *empty
            updates = {"last_workout_id": exercise.workout_id, "last_exercise_id": exercise.id}
            name = exercise.exercise.name
            if intent == CoachIntent.EXERCISE_SETS:
                message = f"{name} está prescrito com {exercise.sets} séries."
            elif intent == CoachIntent.EXERCISE_REPS:
                message = f"{name} está prescrito com {exercise.repetitions} repetições por série."
            elif intent == CoachIntent.EXERCISE_REST:
                message = f"O intervalo prescrito para {name} é de {exercise.rest_seconds} segundos."
            elif intent == CoachIntent.EXERCISE_LOAD:
                message = f"A carga sugerida no seu treino para {name} é {float(exercise.load):g} kg." if exercise.load is not None else f"Não há carga sugerida cadastrada para {name}."
            else:
                performance = self.data.latest_performance(exercise)
                if not performance:
                    message = f"Ainda não encontrei uma execução concluída de {name} no seu histórico."
                else:
                    row = performance["set"]
                    load = f" com {float(row['used_load']):g} kg" if row.get("used_load") is not None else ""
                    reps = f" e {row['completed_reps']} repetições" if row.get("completed_reps") is not None else ""
                    message = f"Na última execução registrada de {name}, você concluiu uma série{load}{reps}."
            return message, updates, [], None
        if intent == CoachIntent.RECENT_WORKOUTS:
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            rows = self.data.recent_sessions()
            return ("Seus treinos concluídos mais recentes são:\n" + "\n".join(f"• {row.workout_name}" for row in rows), {}, [], None) if rows else ("Ainda não encontrei treinos concluídos no seu histórico.", *empty)
        if intent == CoachIntent.NEXT_WORKOUT:
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            found = self.data.next_workout()
            return (f"Seu próximo treino programado é {found[0].name}, em {found[1]} dia(s).", {"last_workout_id": found[0].id}, [], None) if found else ("Não encontrei próximo treino programado.", *empty)
        if intent == CoachIntent.TODAY_SCHEDULE:
            if not self.data.module_enabled("calendar"):
                return "Agenda não está disponível no seu acesso atual.", *empty
            rows = self.data.today_schedule()
            return ("Sua agenda de hoje tem:\n" + "\n".join(f"• {row.event_time.strftime('%H:%M')} — {row.title}" for row in rows), {}, [], None) if rows else ("Não encontrei compromissos visíveis para você hoje.", *empty)
        if intent in {CoachIntent.PROGRESS_SUMMARY, CoachIntent.CURRENT_WEIGHT}:
            if not self.data.module_enabled("progress"):
                return "Progresso não está disponível no seu acesso atual.", *empty
            summary = self.data.progress_summary()
            if intent == CoachIntent.CURRENT_WEIGHT:
                return (f"Seu peso mais recente registrado é {summary['weight']:g} kg.", {}, [], None) if summary["weight"] is not None else ("Ainda não há peso registrado no seu progresso.", *empty)
            last = summary["last"].strftime("%d/%m/%Y") if summary["last"] else None
            message = f"Nos últimos 30 dias, há {summary['completed']} treino(s) concluído(s)."
            if last: message += f" O mais recente foi em {last}."
            return message, {}, [], None
        if intent in {CoachIntent.DIET_TODAY, CoachIntent.MEAL_PLAN}:
            if not self.data.module_enabled("diet"):
                return "Plano alimentar não está disponível no seu acesso atual.", *empty
            plan = self.data.meal_plan()
            if not plan:
                return "Ainda não há plano alimentar ativo cadastrado para você.", *empty
            if intent == CoachIntent.MEAL_PLAN:
                return f"Seu plano alimentar ativo é {plan.name}, com {len(plan.meals)} refeição(ões) cadastrada(s).", {}, [], None
            meals = [meal for meal in plan.meals]
            return ("Suas refeições planejadas são:\n" + "\n".join(f"• {meal.time.strftime('%H:%M') if meal.time else 'Horário livre'} — {meal.name}" for meal in meals), {}, [], None) if meals else (f"O plano {plan.name} não possui refeições cadastradas.", *empty)
        return response_variant("unknown", seed), *empty

    def _escalation(self, text: str, reason: str):
        if not self.data.module_enabled("messages"):
            return CoachEscalation(available=False, reason=reason)
        return CoachEscalation(available=True, reason=reason, token=escalation_token(self.user, text, reason))

    def _rate_limit(self):
        since = datetime.utcnow() - timedelta(minutes=1)
        count = self.db.scalar(select(func.count(AuditLog.id)).where(
            AuditLog.actor_user_id == self.user.id,
            AuditLog.action == "coach_message_received",
            AuditLog.created_at >= since,
        )) or 0
        if count >= RATE_LIMIT_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Limite de mensagens do Coach atingido. Tente novamente em instantes.")

    def _audit(self, action, *, result="success", details=None):
        self.db.add(AuditLog(actor_user_id=self.user.id, action=action, entity_type="coach", result=result, details={"personal_id": str(self.data.student.personal_id), "student_id": str(self.data.student.id), **(details or {})}))
