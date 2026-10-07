from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select

from app.models.audit_log import AuditLog
from app.schemas.coach import CoachEscalation, CoachIntent, CoachMessageResponse, CoachOption
from app.services.coach.classifier import AFFIRMATIVE, NEGATIVE, Classification, IntentClassifier, normalize_text
from app.services.coach.context import decode_context, encode_context
from app.services.coach.data_resolver import CoachDataResolver
from app.services.coach.escalation import escalation_token, send_escalation
from app.services.coach.responses import response_variant


RATE_LIMIT_PER_MINUTE = 30
EXERCISE_INTENTS = {
    CoachIntent.EXERCISE_DETAILS, CoachIntent.EXERCISE_SETS, CoachIntent.EXERCISE_REPS,
    CoachIntent.EXERCISE_LOAD, CoachIntent.EXERCISE_REST, CoachIntent.LAST_EXERCISE_PERFORMANCE,
}
TOPICS = {
    CoachIntent.TODAY_WORKOUT: "workout", CoachIntent.NEXT_WORKOUT: "workout",
    CoachIntent.WORKOUT_EXERCISES: "workout", CoachIntent.RECENT_WORKOUTS: "workout",
    CoachIntent.EXERCISE_DETAILS: "exercise", CoachIntent.EXERCISE_SETS: "exercise",
    CoachIntent.EXERCISE_REPS: "exercise", CoachIntent.EXERCISE_LOAD: "exercise",
    CoachIntent.EXERCISE_REST: "exercise", CoachIntent.LAST_EXERCISE_PERFORMANCE: "exercise",
    CoachIntent.CURRENT_WEIGHT: "progress", CoachIntent.PROGRESS_SUMMARY: "progress",
    CoachIntent.DIET_TODAY: "diet", CoachIntent.MEAL_PLAN: "diet",
    CoachIntent.TODAY_SCHEDULE: "calendar",
}


class CoachService:
    def __init__(self, db, user):
        self.db = db
        self.user = user
        self.data = CoachDataResolver(db, user)
        self.classifier = IntentClassifier()

    def respond(self, payload) -> CoachMessageResponse:
        self._rate_limit()
        context = decode_context(payload.context_token, self.user.id)
        normalized = normalize_text(payload.message)
        self._audit("coach_message_received", details={"length": len(payload.message)})

        confirmation = self._resolve_confirmation(normalized, payload.confirmation_token, context)
        if confirmation:
            return self._finish(*confirmation, context=context)

        classification = self._classify(payload.message, normalized, context)
        message, updates, options, escalation = self._resolve(
            classification.intent, classification.confidence, payload.message, context,
        )
        action = "coach_fallback" if classification.intent == CoachIntent.UNKNOWN else "coach_intent_resolved"
        self._audit(action, result="fallback" if action == "coach_fallback" else "success", details={"intent": classification.intent.value, "confidence": classification.confidence})
        if escalation is not None:
            self._audit("coach_escalation_requested", result="available" if escalation.available else "unavailable", details={"intent": classification.intent.value})
            if escalation.available:
                updates["pending_confirmation"] = "escalate_to_personal"

        topic = TOPICS.get(classification.intent)
        if topic and topic != context.get("last_topic"):
            updates["previous_topic"] = context.get("last_topic")
            if context.get("last_topic") == "workout" and context.get("last_workout_id"):
                updates["previous_workout_id"] = context["last_workout_id"]
            updates["last_topic"] = topic
        updates["last_intent"] = classification.intent.value
        return self._finish(message, classification, updates, options, escalation, context=context)

    def _finish(self, message, classification, updates, options, escalation, *, context):
        for key, value in updates.items():
            if value is None:
                context.pop(key, None)
            else:
                context[key] = value
        self.db.commit()
        return CoachMessageResponse(
            intent=classification.intent,
            confidence=classification.confidence,
            message=message,
            context_token=encode_context(self.user.id, context),
            options=options,
            escalation=escalation,
        )

    def _resolve_confirmation(self, normalized, token, context):
        if not context.get("pending_confirmation"):
            return None
        if normalized in NEGATIVE:
            classification = Classification(CoachIntent.UNKNOWN, "confirmation", normalized)
            return response_variant("cancelled", str(self.user.id)), classification, {"pending_confirmation": None}, [], None
        if normalized not in AFFIRMATIVE:
            return None
        classification = Classification(CoachIntent.CONTACT_PERSONAL, "confirmation", normalized)
        if not token or not self.data.module_enabled("messages"):
            return "Não consegui confirmar o encaminhamento. Use a ação exibida na mensagem anterior.", classification, {}, [], None
        try:
            row, fingerprint, duplicate = send_escalation(self.db, self.user, token)
        except ValueError:
            return "A confirmação expirou. Faça a solicitação novamente se ainda precisar.", classification, {"pending_confirmation": None}, [], None
        if not duplicate:
            self.db.add(AuditLog(
                actor_user_id=self.user.id, action="coach_escalation_sent", entity_type="coach", entity_id=fingerprint,
                details={"personal_id": str(self.data.student.personal_id), "student_id": str(self.data.student.id), "message_id": str(row.id)},
            ))
        return ("Essa solicitação já foi encaminhada." if duplicate else response_variant("escalated", str(self.user.id))), classification, {"pending_confirmation": None}, [], None

    def _classify(self, text, normalized, context):
        if context.get("pending_clarification") == "weight_type":
            if any(word in normalized for word in ("corporal", "meu peso", "eu peso")):
                return Classification(CoachIntent.CURRENT_WEIGHT, "clarified", normalized)
            if any(word in normalized for word in ("exercicio", "carga", "treino")):
                return Classification(CoachIntent.EXERCISE_LOAD, "clarified", normalized)
        if context.get("pending_clarification") == "exercise" and context.get("pending_intent"):
            try:
                return Classification(CoachIntent(context["pending_intent"]), "clarified", normalized)
            except ValueError:
                pass
        if normalized in AFFIRMATIVE and context.get("last_intent") == CoachIntent.TODAY_WORKOUT.value:
            return Classification(CoachIntent.WORKOUT_EXERCISES, "context", normalized)
        classification = self.classifier.classify(text, has_exercise_context=bool(context.get("last_exercise_id")))
        if classification.intent == CoachIntent.UNKNOWN and classification.confidence == "unknown" and self.data.module_enabled("workouts"):
            exercise, matches = self.data.resolve_exercise(text, context)
            if exercise or matches:
                return Classification(CoachIntent.EXERCISE_DETAILS, "entity", normalized)
        return classification

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
            if confidence == "ambiguous":
                options = [CoachOption(label="Meu peso corporal", message="Meu peso corporal"), CoachOption(label="Carga de exercício", message="A carga do exercício")]
                return response_variant("ambiguous_weight", seed), {"pending_clarification": "weight_type"}, options, None
            return response_variant("unknown", seed), {}, [], self._escalation(text, intent.value)
        if intent in {CoachIntent.TODAY_WORKOUT, CoachIntent.WORKOUT_EXERCISES}:
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            workout = self.data.today_workout() if intent == CoachIntent.TODAY_WORKOUT else self.data.workout_from_context(context)
            if not workout and "voltando" in normalize_text(text) and context.get("previous_workout_id"):
                workout = self.data.workout_from_context({"last_workout_id": context["previous_workout_id"]})
            workout = workout or self.data.today_workout()
            if not workout:
                return response_variant("no_workout", seed), *empty
            updates = {"last_workout_id": workout.id, "last_date_reference": "0"}
            if intent == CoachIntent.TODAY_WORKOUT:
                options = [CoachOption(label="Ver exercícios", message="Quais exercícios?"), CoachOption(label="Próximo treino", message="Qual o próximo treino?")]
                return f"Hoje você tem {workout.name}.", updates, options, None
            if not workout.exercises:
                return f"O treino {workout.name} ainda não possui exercícios cadastrados.", updates, [], None
            lines = [f"• {item.exercise.name} — {item.sets} séries de {item.repetitions}" for item in workout.exercises]
            return f"Seu treino {workout.name} tem:\n" + "\n".join(lines), updates, [], None
        if intent == CoachIntent.NEXT_WORKOUT:
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            normalized = normalize_text(text)
            if "amanha" in normalized:
                workout = self.data.workout_for_offset(1)
                return (f"Amanhã você tem {workout.name}.", {"last_workout_id": workout.id, "last_date_reference": "1"}, [], None) if workout else (response_variant("no_workout", seed), {"last_date_reference": "1"}, [], None)
            after = int(context.get("last_date_reference", "0")) if "depois" in normalized else 0
            found = self.data.next_workout(after)
            if not found:
                return "Não encontrei próximo treino programado.", *empty
            offset = after + found[1]
            return f"Seu próximo treino é {found[0].name}, em {found[1]} dia(s).", {"last_workout_id": found[0].id, "last_date_reference": str(offset)}, [], None
        if intent in EXERCISE_INTENTS:
            return self._exercise_response(intent, text, context)
        if intent == CoachIntent.RECENT_WORKOUTS:
            if not self.data.module_enabled("workouts"):
                return "Treinos não estão disponíveis no seu acesso atual.", *empty
            rows = self.data.recent_sessions()
            return ("Seus treinos concluídos mais recentes são:\n" + "\n".join(f"• {row.workout_name}" for row in rows), {}, [], None) if rows else ("Ainda não encontrei treinos concluídos no seu histórico.", *empty)
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
                return (f"Seu peso mais recente é {summary['weight']:g} kg.", {"pending_clarification": None}, [], None) if summary["weight"] is not None else ("Ainda não há peso registrado no seu progresso.", *empty)
            last = summary["last"].strftime("%d/%m/%Y") if summary["last"] else None
            message = f"Nos últimos 30 dias, há {summary['completed']} treino(s) concluído(s)."
            if last:
                message += f" O mais recente foi em {last}."
            return message, {}, [], None
        if intent in {CoachIntent.DIET_TODAY, CoachIntent.MEAL_PLAN}:
            if not self.data.module_enabled("diet"):
                return "Plano alimentar não está disponível no seu acesso atual.", *empty
            plan = self.data.meal_plan()
            if not plan:
                return "Ainda não há plano alimentar ativo cadastrado para você.", *empty
            if intent == CoachIntent.MEAL_PLAN:
                return f"Seu plano alimentar ativo é {plan.name}, com {len(plan.meals)} refeição(ões).", {}, [CoachOption(label="Ver refeições", message="Quais minhas refeições hoje?")], None
            meals = list(plan.meals)
            return ("Suas refeições planejadas são:\n" + "\n".join(f"• {meal.time.strftime('%H:%M') if meal.time else 'Horário livre'} — {meal.name}" for meal in meals), {}, [], None) if meals else (f"O plano {plan.name} não possui refeições cadastradas.", *empty)
        return response_variant("unknown", seed), *empty

    def _exercise_response(self, intent, text, context):
        empty = ({}, [], None)
        if not self.data.module_enabled("workouts"):
            return "Treinos não estão disponíveis no seu acesso atual.", *empty
        exercise, matches = self.data.resolve_exercise(text, context)
        if not exercise and len(matches) > 1:
            prompts = {
                CoachIntent.EXERCISE_DETAILS: "Sobre", CoachIntent.EXERCISE_SETS: "Quantas séries de",
                CoachIntent.EXERCISE_REPS: "Quantas repetições de", CoachIntent.EXERCISE_LOAD: "Qual carga de",
                CoachIntent.EXERCISE_REST: "Qual intervalo de", CoachIntent.LAST_EXERCISE_PERFORMANCE: "Quanto fiz na última vez em",
            }
            options = [CoachOption(label=row.exercise.name, message=f"{prompts[intent]} {row.exercise.name}?") for row in matches[:6]]
            updates = {"pending_clarification": "exercise", "pending_intent": intent.value, "candidate_exercise_ids": [row.id for row in matches[:6]]}
            return "Encontrei mais de um exercício. Qual deles?", updates, options, None
        if not exercise:
            return "Qual exercício você quer consultar?", {"pending_clarification": "exercise", "pending_intent": intent.value}, [], None
        updates = {
            "last_workout_id": exercise.workout_id, "last_exercise_id": exercise.id,
            "last_entity_type": "exercise", "last_entity_id": exercise.id,
            "pending_clarification": None, "pending_intent": None, "candidate_exercise_ids": None,
        }
        name = exercise.exercise.name
        actions = [
            CoachOption(label="Séries e repetições", message="Quantas séries e repetições?"),
            CoachOption(label="Carga", message="Qual carga?"), CoachOption(label="Descanso", message="Qual descanso?"),
            CoachOption(label="Última execução", message="Quanto fiz da última vez?"),
        ]
        if intent == CoachIntent.EXERCISE_DETAILS:
            return f"{name}: {exercise.sets} séries de {exercise.repetitions} repetições.", updates, actions, None
        if intent == CoachIntent.EXERCISE_SETS:
            return f"{exercise.sets} séries de {exercise.repetitions} repetições.", updates, actions[1:], None
        if intent == CoachIntent.EXERCISE_REPS:
            return f"{exercise.repetitions} repetições por série.", updates, actions[1:], None
        if intent == CoachIntent.EXERCISE_REST:
            return f"O descanso prescrito é de {exercise.rest_seconds} segundos.", updates, actions[:2], None
        if intent == CoachIntent.EXERCISE_LOAD:
            message = f"A carga sugerida é {float(exercise.load):g} kg." if exercise.load is not None else f"Não há carga sugerida cadastrada para {name}."
            return message, updates, actions[2:], None
        performance = self.data.latest_performance(exercise)
        if not performance:
            return f"Ainda não encontrei uma execução concluída de {name}.", updates, actions[:3], None
        row = performance["set"]
        load = f" com {float(row['used_load']):g} kg" if row.get("used_load") is not None else ""
        reps = f" e {row['completed_reps']} repetições" if row.get("completed_reps") is not None else ""
        return f"Na última execução de {name}, você concluiu uma série{load}{reps}.", updates, actions[:3], None

    def _escalation(self, text, reason):
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
        self.db.add(AuditLog(
            actor_user_id=self.user.id, action=action, entity_type="coach", result=result,
            details={"personal_id": str(self.data.student.personal_id), "student_id": str(self.data.student.id), **(details or {})},
        ))
