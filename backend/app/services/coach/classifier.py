import re
import unicodedata
from dataclasses import dataclass

from app.schemas.coach import CoachIntent


@dataclass(frozen=True)
class Classification:
    intent: CoachIntent
    confidence: str
    normalized: str


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower())
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    aliases = {r"\bqnts?\b": "quantas", r"\bqnt\b": "quanto", r"\boq\b": "o que", r"\bhj\b": "hoje", r"\breps?\b": "repeticoes", r"\bserie\b": "series", r"\bta\b": "esta"}
    for pattern, replacement in aliases.items():
        value = re.sub(pattern, replacement, value)
    return " ".join(value.split())


class IntentClassifier:
    def classify(self, text: str, *, has_exercise_context: bool = False) -> Classification:
        value = normalize_text(text)
        rules = (
            (CoachIntent.PAIN_OR_INJURY, r"\b(dor|doendo|machuquei|lesao|lesionei|fisgada|emergencia|sangrando|desmaio)\b"),
            (CoachIntent.CHANGE_WORKOUT_REQUEST, r"\b(trocar|substituir|aumentar|diminuir|mudar)\b.*\b(exercicio|carga|series|treino)\b|\bposso fazer (outro|mais|menos)\b"),
            (CoachIntent.LAST_EXERCISE_PERFORMANCE, r"\b(ultima vez|ultima carga|quanto fiz|executei)\b"),
            (CoachIntent.TODAY_WORKOUT, r"\b(treino).*(hoje)|\b(o que|qual|tem).*(treino).*(hoje)\b"),
            (CoachIntent.WORKOUT_EXERCISES, r"\b(quais|mostrar|mostra|lista|ver)\b.*\b(exercicios|exercicio)\b|\bexercicios (de hoje|do treino)\b"),
            (CoachIntent.EXERCISE_SETS, r"\b(quantas|numero de)\b.*\bseries\b|\bseries\b.*\b(de|do|da|no)\b"),
            (CoachIntent.EXERCISE_REPS, r"\b(quantas|numero de)\b.*\b(repeticoes)\b|\brepeticoes\b.*\b(de|do|da|no)\b"),
            (CoachIntent.EXERCISE_REST, r"\b(descanso|intervalo|tempo entre)\b"),
            (CoachIntent.EXERCISE_LOAD, r"\b(carga|quanto peso|peso no|peso do|peso da)\b"),
            (CoachIntent.RECENT_WORKOUTS, r"\b(treinos recentes|ultimos treinos|treinei recentemente)\b"),
            (CoachIntent.NEXT_WORKOUT, r"\b(proximo treino|treino amanha|o que treino amanha)\b"),
            (CoachIntent.TODAY_SCHEDULE, r"\b(agenda|compromisso|horario).*(hoje)|\bhoje.*(agenda|compromisso|horario)\b"),
            (CoachIntent.PROGRESS_SUMMARY, r"\b(meu progresso|minha evolucao|como estou evoluindo|resumo.*progresso)\b"),
            (CoachIntent.CURRENT_WEIGHT, r"\b(meu peso atual|quanto eu peso|peso corporal)\b"),
            (CoachIntent.DIET_TODAY, r"\b(dieta|refeicao|comer|alimentacao).*(hoje)\b"),
            (CoachIntent.MEAL_PLAN, r"\b(plano alimentar|minha dieta|minhas refeicoes)\b"),
            (CoachIntent.CONTACT_PERSONAL, r"\b(falar|conversar|contato|mensagem|chamar)\b.*\bpersonal\b"),
            (CoachIntent.HELP, r"\b(ajuda|o que voce faz|como funciona|opcoes)\b"),
            (CoachIntent.GREETING, r"^(oi|ola|bom dia|boa tarde|boa noite|e ai|fala)(\s|$)"),
        )
        for intent, pattern in rules:
            if re.search(pattern, value):
                return Classification(intent, "match", value)
        if value in {"qual carga", "e qual carga", "quantas series", "e quantas series", "quantas repeticoes", "qual descanso"} and has_exercise_context:
            intent = CoachIntent.EXERCISE_LOAD if "carga" in value else CoachIntent.EXERCISE_SETS if "series" in value else CoachIntent.EXERCISE_REPS if "repet" in value else CoachIntent.EXERCISE_REST
            return Classification(intent, "match", value)
        if value in {"peso", "qual peso", "quanto peso"}:
            return Classification(CoachIntent.UNKNOWN, "ambiguous", value)
        return Classification(CoachIntent.UNKNOWN, "unknown", value)
