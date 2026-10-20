# Fitland - Release Candidate Final

Data: 2026-10-19 (America/Sao_Paulo)
Base do candidato: `a8e10deeed3629d85f858e723e49f7a1d7a20012`
Baseline publicado: `d535450909a5d4a77ede810a655e2457171cfc6f`
Producao: <https://fitland.up.railway.app>
Escopo: codigo e QA locais; nenhum push, deploy, migration ou escrita em producao.

## 1. Resumo executivo

Foram implementados cards de video do treino do Aluno com miniatura de YouTube ou do upload autorizado, player sob demanda, fechamento por botao/Escape, restauracao de foco e erro de carregamento acessivel. Exercicios sem video nao exibem placeholder vazio. Timer, series, carga e sessao continuam fora do estado do player.

A migration `20261019_add_auth_security_state.sql` foi executada em PostgreSQL 18.3 local e descartavel. Foram validados schema anterior sintetico, aplicacao e reaplicacao, PK, FK, CHECK, indices, cascade, rollback de falha parcial, concorrencia, backup e restauracao. A versao principal de producao nao esta exposta no repositorio; portanto, a equivalencia exata de major version permanece por confirmar antes do deploy.

O candidato passou em backend, frontend, Playwright/Chromium, build, compileall, diff-check e npm audit. `python-jose` foi atualizado de 3.3.0 para 3.5.0; os 31 warnings restantes foram eliminados sem regressao.

**Decisao: NAO APTO para publicacao imediata.** O codigo esta em condicao de piloto/homologacao, mas os criterios do roteiro exigem E2E autenticado integral frontend-backend e confirmacao da mesma major version PostgreSQL de producao. Os testes Playwright desta rodada usam respostas API sinteticas e, corretamente, nao sao classificados como E2E integral.

## 2. Pendencias anteriores

| ID | Pendencia | Resultado atual |
|---|---|---|
| QA-UPQ-001 | PostgreSQL real | FECHADA COM RESSALVA: PostgreSQL 18.3 validado; major de producao desconhecida |
| QA-UPQ-002 | Privacidade dos retratos | FECHADA NO CANDIDATO: arquivos e referencias ausentes; 404/410 em producao depende do deploy |
| QA-UPQ-003 | E2E real | PARCIAL: Chromium/axe reais com API sintetica; cadeia autenticada completa nao executada |
| QA-UPQ-004 | CSS | INVESTIGADA: 451,39 kB / 75,33 kB gzip; nenhuma remocao insegura realizada |
| QA-UPQ-005 | Warnings backend | FECHADA: 31 -> 0 com `python-jose 3.5.0` |

## 3. Videos de exercicios

- YouTube: thumbnail real e iframe somente apos interacao.
- Upload autorizado: preview pelo proprio video, sem expor storage key adicional.
- Sem video: card permanece organizado e nao exibe miniatura falsa.
- URL/upload invalido: mensagem `role=alert`, sem quebra do treino.
- Modal: nome acessivel, foco inicial, Escape e retorno ao gatilho.
- Estado: abrir/fechar player nao altera execucao, timer, series ou cargas.
- Duplicidade: removido o segundo botao `Ver execucao`.
- Cobertura: testes unitarios e Playwright em Chromium.

Arquivos principais:

- `frontend/src/pages/WorkoutExecution.jsx`
- `frontend/src/styles/global.css`
- `frontend/tests/workoutExperience.test.js`
- `frontend/e2e/release-candidate.spec.js`

## 4. PostgreSQL e migration

Ambiente: PostgreSQL 18.3 local, porta dedicada `55432`, bases sinteticas `fitland_qa*`, sem conexao com producao.

Resultados:

- Esquema anterior sintetico: OK.
- Primeira aplicacao: OK.
- Reaplicacao controlada: OK (`IF NOT EXISTS`).
- `refresh_token_sessions`: PK, unique JTI, FK user, indices e cascade OK.
- `rate_limit_buckets`: PK, CHECK `attempts >= 0` e indices OK.
- Dado com FK invalida: rejeitado.
- Tentativa negativa: rejeitada.
- Falha no meio de transacao: rollback integral; tabela-probe ausente.
- Concorrencia de refresh: uma rotacao aceita, replay concorrente recebe 401.
- Concorrencia do bucket: tres incrementos preservados.
- Revogacao, expiracao e replay: OK pelos testes de servico.
- Backup `pg_dump`: OK.
- Restauracao `pg_restore`: OK, contagens/FK/CHECK preservados.
- Compatibilidade do codigo candidato: 4/4 testes no PostgreSQL.

Ressalva: a major version do PostgreSQL Railway deve ser confirmada antes da publicacao. Nenhuma migration foi executada em producao.

## 5. Navegador, visual e acessibilidade

Playwright 1.64.1 com Chromium real e axe-core:

- 320, 360, 375, 390, 430, 768, 1024 e 1440 px: login tenant sem overflow.
- Branding dinamico sintetico: OK.
- Video YouTube: OK.
- Upload invalido/erro acessivel: OK.
- Exercicio sem video: OK.
- Escape e restauracao de foco: OK.
- Timer preservado ao fechar: OK.
- Axe nos cenarios cobertos: zero violacoes.
- Screenshots: `frontend/test-results/e2e-artifacts` (artefato ignorado pelo Git).

Problemas objetivos encontrados e corrigidos:

1. Login sem `h1`: adicionado titulo apenas para tecnologia assistiva.
2. Segundo landmark `main` na execucao: removida a aninhacao.
3. Badge de notificacao divergente do nome acessivel: nome e contador alinhados.
4. Rota `/dashboard/aluno` capturava sessao autenticada como entrada legada: fallback agora vale somente sem sessao.

Nao foi executada auditoria integral autenticada de todas as telas, light/dark, zoom 200%, orientacao horizontal ou leitor de tela real. Nao se declara conformidade WCAG 2.2 AA completa.

## 6. Performance

| Metrica | Antes | Depois | Observacao |
|---|---:|---:|---|
| CSS build | 451,17 kB | 451,39 kB | +0,22 kB pelos estados de video/erro |
| CSS gzip | 75,29 kB | 75,33 kB | +0,04 kB |
| JS inicial | 267,23 kB | 267,33 kB | variacao de build |
| JS inicial gzip | 84,72 kB | 84,72 kB | estavel |

Foram analisadas 4.231 regras e 15 grupos textualmente duplicados. As repeticoes aparecem em contextos responsivos/tematicos; nao foram removidas sem cobertura de uso por rota. O CSS monolitico permanece divida P2, sem regressao visual introduzida para perseguir uma reducao artificial.

## 7. Warnings e dependencias

- Antes: 31 warnings de `python-jose 3.3.0` usando `datetime.utcnow()`.
- Depois: 0 warnings.
- Mudanca: `python-jose[cryptography]` 3.3.0 -> 3.5.0.
- Regressao backend depois da atualizacao: 292 passed, 1 skipped, 0 warnings.
- O skip e o teste PostgreSQL opcional; ele passou 4/4 quando `TEST_POSTGRESQL_URL` foi fornecida.

## 8. Seguranca

- Refresh persistente, rotacao, revogacao, expiracao e replay: OK.
- Concorrencia PostgreSQL: OK.
- Rate limit persistente e chave hasheada: OK.
- Auth/RBAC/feature flags/multi-tenant: suites existentes verdes.
- Access token em memoria e cookies/headers: suites existentes verdes.
- Uploads privados e isolamento: suites existentes verdes.
- Retratos `erika-gomes.jpeg` e `jessica-gomes.png`: ausentes do codigo, referencias e build candidato.
- Segredos/credenciais adicionados: nenhum.
- Producao/dados reais alterados: nao.

## 9. Resultado dos 84 cenarios

Mantem-se a matriz funcional detalhada de `ULTIMATE_PREMIUM_QA_a8e10de.md`, agora com evidencias adicionais de PostgreSQL e navegador.

- Total mapeado: 84.
- PASS-AUTO: 81.
- PASS-E2E integral frontend-backend: 0.
- PASS-VISUAL adicional: login responsivo e fluxo de videos nos cenarios Playwright cobertos.
- FALHOU: 0.
- BLOQUEADO: 3 (visual autenticado integral Personal, Gemini real, visual autenticado integral Aluno).
- NAO EXECUTADO: 0 na matriz automatizada original.

Os 81 `PASS-AUTO` nao foram renomeados como E2E. Os nove testes Playwright desta rodada sao evidencias reais de navegador com backend interceptado/sintetico.

## 10. Suites finais

| Suite | Resultado |
|---|---|
| Backend SQLite | 292 passed, 1 PostgreSQL-only skipped, 0 failed, 0 warnings |
| Backend PostgreSQL | 4 passed, 0 failed |
| Frontend | 168 passed, 0 failed |
| Playwright Chromium | 9 passed, 0 failed |
| Vite build | OK, 1.639 modulos |
| Python compileall | OK |
| `git diff --check` | OK |
| npm audit | 0 vulnerabilidades |

## 11. Bugs encontrados

Corrigidos nesta rodada:

- Rota autenticada de aluno tratada como entrada legada.
- Falta de `h1` no login.
- Landmark `main` duplicado.
- Nome acessivel de notificacao divergente do contador.
- Placeholder de video vazio.
- Falta de erro acessivel no player de upload.
- Falta de Escape/restauracao de foco no player.

Sem P0 confirmado. Nenhuma falha automatizada restante.

## 12. Riscos residuais

1. Confirmar major version PostgreSQL de producao e, se diferente de 18, repetir a migration nessa major.
2. Executar E2E autenticado frontend-backend em homologacao para Owner, Personal e Aluno.
3. Auditar visualmente todas as rotas em light/dark, zoom 200% e orientacao horizontal.
4. CSS continua monolitico em 451,39 kB.
5. Retratos antigos so deixarao de ser servidos apos deploy e eventual purge de cache/CDN.
6. O deploy deve observar CSP, refresh/rate limit e erros 5xx antes de liberar trafego.

## 13. Migrations pendentes e ordem segura

Migration pendente: `backend/migrations/20261019_add_auth_security_state.sql`.

Ordem recomendada:

1. Confirmar versao PostgreSQL e janela de manutencao.
2. Gerar backup consistente e testar leitura do artefato.
3. Aplicar a migration antes de o codigo candidato receber trafego.
4. Validar tabelas, constraints e indices em leitura.
5. Publicar o commit candidato.
6. Confirmar `/health`, versao e headers.
7. Executar login/refresh/logout por contexto e rejeicao de replay.
8. Executar branding, videos e isolamento cross-tenant.
9. Confirmar 404/410 dos retratos antigos e tratar cache/CDN.
10. Monitorar 401/403/429/500 e logs sanitizados.

## 14. Rollback

- Preferir rollback do codigo: a migration e aditiva e compativel com o baseline.
- Nao remover as tabelas durante incidente sem avaliar sessoes/rate limits gravados.
- Se a migration falhar antes do commit, a transacao deve ser revertida e o deploy interrompido.
- Se o codigo falhar apos a migration, restaurar o release anterior mantendo as tabelas.
- Restauracao de banco deve usar o backup validado somente em incidente que exija reversao de dados.
- Nao presumir rollback destrutivo de schema como seguro.

## 15. Decisao final

**NAO APTO PARA PUBLICACAO IMEDIATA.**

Justificativa: zero P0 e todas as suites verdes, mas o criterio de aprovacao exige autenticacao/isolamento/fluxos essenciais em E2E integral e PostgreSQL da mesma major de producao. Essas duas evidencias ainda nao existem. O candidato esta **apto para piloto/homologacao controlada com ressalvas**, sem push ou deploy nesta tarefa.

Estado:

- Banco de producao alterado: NAO.
- Dados reais alterados: NAO.
- Migration em producao: NAO.
- Push: NAO.
- Deploy: NAO.
