import hashlib


RESPONSES = {
    "greeting": [
        "Oi! Como posso ajudar com seu treino hoje?",
        "Olá! Quer consultar treino, progresso, agenda ou plano alimentar?",
        "Oi! Estou por aqui. O que você quer consultar?",
        "Olá! Posso buscar suas informações registradas no Fitland.",
        "Oi! Quer começar pelo treino de hoje?",
    ],
    "help": ["Posso consultar seus treinos, exercícios, progresso, agenda e plano alimentar usando apenas dados registrados no Fitland."],
    "unknown": [
        "Não consegui entender isso com segurança. Posso ajudar com treino, progresso, agenda ou plano alimentar.",
        "Meu foco é consultar suas informações do Fitland. Quer perguntar sobre treino, dieta, agenda ou progresso?",
        "Não encontrei uma resposta segura para essa pergunta. Posso encaminhá-la ao seu Personal.",
        "Essa pergunta está fora do que consigo consultar no Fitland.",
        "Não quero adivinhar. Tente perguntar sobre um dado registrado no seu acompanhamento.",
    ],
    "ambiguous_weight": ["Você quer saber seu peso corporal ou a carga de um exercício?"],
    "no_workout": ["Não encontrei treino programado para essa data.", "Não há treino cadastrado para esse dia."],
    "no_exercise": ["Não encontrei esse exercício nos seus treinos atuais."],
    "pain": ["Sinto muito que você esteja sentindo isso. Não consigo avaliar lesões ou indicar tratamento. Se os sintomas forem fortes, súbitos ou preocupantes, procure atendimento de saúde. Posso encaminhar sua mensagem ao seu Personal."],
    "change": ["Essa alteração precisa ser confirmada pelo seu Personal. Posso encaminhar sua solicitação para ele."],
    "cancelled": ["Tudo bem. Não vou encaminhar."],
    "escalated": ["Encaminhado para seu Personal."],
}


def response_variant(key: str, seed: str) -> str:
    values = RESPONSES[key]
    index = int(hashlib.sha256(f"{key}:{seed}".encode()).hexdigest()[:8], 16) % len(values)
    return values[index]
