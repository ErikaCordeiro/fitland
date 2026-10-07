import re
import unicodedata
from dataclasses import dataclass

from app.schemas.coach import CoachIntent


SYNONYMS = {
    "series": ("serie", "series", "set", "sets"),
    "repeticoes": ("rep", "reps", "repeticao", "repeticoes", "repetico"),
    "carga": ("carga", "kg"),
    "descanso": ("descanso", "descanco", "intervalo", "pausa"),
    "treino": ("treino", "treio", "ficha", "rotina"),
    "exercicio": ("exercicio", "exercico"),
}

ALIASES = {
    r"\bqnts?\b": "quantas", r"\bqnt\b": "quanto", r"\boq\b": "o que",
    r"\bhj\b": "hoje", r"\bd hj\b": "de hoje", r"\bta\b": "esta", r"\bq\b": "qual",
}


@dataclass(frozen=True)
class Classification:
    intent: CoachIntent
    confidence: str
    normalized: str


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower())
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    for pattern, replacement in ALIASES.items():
        value = re.sub(pattern, replacement, value)
    for canonical, aliases in SYNONYMS.items():
        value = re.sub(rf"\b(?:{'|'.join(map(re.escape, aliases))})\b", canonical, value)
    return " ".join(value.split())


AFFIRMATIVE = {"sim", "s", "pode", "pode sim", "quero", "manda", "isso", "claro"}
NEGATIVE = {"nao", "n", "agora nao", "deixa", "nao precisa", "cancela"}


class IntentClassifier:
    def classify(self, text: str, *, has_exercise_context: bool = False) -> Classification:
        value = normalize_text(text)
        rules = (
            (CoachIntent.PAIN_OR_INJURY, r"\b(dor|doendo|doeu|machuquei|lesao|lesionei|fisgada|inchou|emergencia|sangrando|desmaio)\b|nao consigo mexer|estalo e dor"),
            (CoachIntent.CHANGE_WORKOUT_REQUEST, r"\b(trocar|substituir|aumentar|diminuir|mudar|pular)\b.*\b(exercicio|carga|series|treino|peso)\b|\b(posso|vou) (fazer outro|colocar mais|diminuir|fazer [0-9]+ series|pular)\b|troco por qual"),
            (CoachIntent.LAST_EXERCISE_PERFORMANCE, r"\b(ultima vez|ultima carga|quanto fiz|executei)\b"),
            (CoachIntent.TODAY_WORKOUT, r"\b(treino|o que faco).*(hoje)|\b(o que|qual|tem).*(treino).*(hoje)\b|^(meu )?treino$"),
            (CoachIntent.NEXT_WORKOUT, r"\b(proximo treino|treino amanha|o que treino amanha|e amanha|e depois)\b"),
            (CoachIntent.WORKOUT_EXERCISES, r"\b(quais|mostrar|mostra|lista|ver|me mostra)\b.*\b(exercicios|exercicio)\b|\bexercicios (de hoje|do treino)\b|voltando.*treino"),
            (CoachIntent.EXERCISE_SETS, r"\b(quantas|numero de)\b.*\bseries\b|\bseries\b|quantas faco|^quantas$"),
            (CoachIntent.EXERCISE_REPS, r"\b(quantas|numero de)\b.*\brepeticoes\b|\brepeticoes\b"),
            (CoachIntent.EXERCISE_REST, r"\b(descanso|tempo entre|quanto tempo)\b"),
            (CoachIntent.EXERCISE_LOAD, r"\b(carga|quanto peso|peso no|peso do|peso da|quanto boto|quanto de peso)\b"),
            (CoachIntent.RECENT_WORKOUTS, r"\b(treinos recentes|ultimos treinos|treinei recentemente|ultimo treino|meu ultimo treino|treinei o que ontem|o que fiz ontem)\b"),
            (CoachIntent.TODAY_SCHEDULE, r"\b(agenda|compromisso|horario).*(hoje)|\bhoje.*(agenda|compromisso|horario)\b"),
            (CoachIntent.PROGRESS_SUMMARY, r"\b(meu progresso|minha evolucao|como estou evoluindo|como estou indo|acha que estou evoluindo|resumo.*progresso)\b"),
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
        if has_exercise_context and value in {"ele", "esse", "esse exercicio", "isso", "dele", "desse", "do mesmo", "o anterior"}:
            return Classification(CoachIntent.EXERCISE_DETAILS, "context", value)
        if has_exercise_context and value in {"qual carga", "e qual carga", "quantas series", "e quantas series", "quantas repeticoes", "e repeticoes", "qual descanso"}:
            intent = CoachIntent.EXERCISE_LOAD if "carga" in value else CoachIntent.EXERCISE_SETS if "series" in value else CoachIntent.EXERCISE_REPS if "repet" in value else CoachIntent.EXERCISE_REST
            return Classification(intent, "context", value)
        if value in {"peso", "qual peso", "quanto peso"}:
            return Classification(CoachIntent.UNKNOWN, "ambiguous", value)
        return Classification(CoachIntent.UNKNOWN, "unknown", value)
