import hashlib


RESPONSES = {
    "greeting": ["Oi! Como posso ajudar com seu treino hoje?", "Olá! Estou por aqui. Quer consultar treino, progresso, agenda ou plano alimentar?"],
    "help": ["Posso consultar seus treinos, exercícios, progresso, agenda e plano alimentar usando apenas dados registrados no Fitland."],
    "unknown": ["Não consegui entender essa pergunta com segurança. Posso ajudar com treino, progresso, agenda ou plano alimentar."],
    "ambiguous_weight": ["Você quer saber seu peso corporal atual ou a carga de algum exercício?"],
    "no_workout": ["Não encontrei treino programado para hoje."],
    "no_exercise": ["Não encontrei esse exercício nos seus treinos atuais."],
    "pain": ["Sinto muito que você esteja sentindo isso. Não consigo avaliar lesões ou indicar tratamento. Se os sintomas forem fortes, súbitos ou preocupantes, procure atendimento de saúde. Posso encaminhar sua mensagem ao seu Personal."],
    "change": ["Essa alteração precisa ser confirmada pelo seu Personal. Posso encaminhar sua solicitação para ele."],
}


def response_variant(key: str, seed: str) -> str:
    values = RESPONSES[key]
    index = int(hashlib.sha256(f"{key}:{seed}".encode()).hexdigest()[:8], 16) % len(values)
    return values[index]
