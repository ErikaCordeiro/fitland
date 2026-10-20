# Fitland - Ultimate Premium QA

> Snapshot historico anterior a finalizacao. Para o estado atual, consulte `RELEASE_CANDIDATE_FINAL_a8e10de.md`.

Data: 2026-10-19 (America/Sao_Paulo)
Candidato: `a8e10deeed3629d85f858e723e49f7a1d7a20012`
Baseline/publicado: `d535450909a5d4a77ede810a655e2457171cfc6f`
Producao: <https://fitland.up.railway.app>
Escopo: auditoria sem alteracao funcional, commit, push, deploy ou escrita em producao.

## 1. Resumo executivo

O candidato compila e passa integralmente nas suites disponiveis: backend 292/292, frontend 166/166, Vite OK, compileall OK, diff-check OK e npm audit com 0 vulnerabilidades. A reducao do JavaScript inicial foi confirmada de 485,66 kB para 267,23 kB (gzip: 138,32 kB para 84,72 kB). O health de producao respondeu HTTP 200 e confirmou que a versao publicada ainda e o baseline `d535450`, nao o candidato.

O candidato corrige tecnicamente os 10 achados anteriores. Entretanto, a migration `20261019_add_auth_security_state.sql` nao foi executada em PostgreSQL isolado: Docker Desktop esta instalado, mas o daemon nao ficou acessivel, e nao ha `psql` local. Os testes de modelo/servico em SQLite passam, mas isso nao valida DDL PostgreSQL, aplicacao sobre esquema anterior, backup/restauracao nem comportamento multi-instancia real.

Em producao, os retratos antigos ainda estao publicos (`/erika-gomes.jpeg` e `/jessica-gomes.png`, ambos HTTP 200), como esperado enquanto o candidato nao for publicado. O build candidato nao contem esses arquivos nem referencias. A publicacao deve incluir verificacao de remocao e eventual invalidacao de cache/CDN.

**Decisao: NAO APTO para publicacao imediata.** Motivos de bloqueio: migration ainda nao validada em PostgreSQL real; smoke autenticado Owner/Personal/Aluno no candidato nao executado; auditorias Lighthouse/axe e E2E de navegador do candidato indisponiveis. O codigo esta em boa condicao para uma rodada de homologacao/piloto assim que esses bloqueios forem fechados.

## 2. Preparacao e ambiente

| Item | Resultado | Evidencia |
|---|---|---|
| Branch local | `main`, 1 commit a frente de `origin/main` | `git status --short --branch` |
| HEAD local | `a8e10de...` | `git rev-parse HEAD` |
| `origin/main` | `d535450...` | `git rev-parse origin/main` |
| Producao | `d535450909a5`, deployment `37efdb1c-76c` | `/health`, headers `x-fitland-build` e body |
| Health | HTTP 200 | `GET https://fitland.up.railway.app/health` |
| Integridade Git | OK | `git fsck --no-progress` sem erros; baseline e ancestral do candidato |
| Working tree antes do relatorio | Limpa | `git status --short` |
| PostgreSQL isolado | BLOQUEADO | Docker daemon inacessivel; `psql` ausente |
| Playwright/Cypress | Ausentes no projeto | inventario de dependencias |
| Navegador real | Disponivel para producao | Codex In-app Browser |
| Lighthouse/axe | Indisponiveis | nao instalados/configurados |
| DevTools/console | Console disponivel; Network detalhado indisponivel | browser tooling |

## 3. Revalidacao dos 10 achados

| ID | Problema | Status | Evidencia | Risco residual |
|---|---|---|---|---|
| QA-P0-001 | Fotografias pessoais publicas | CORRIGIDO NO CANDIDATO | arquivos removidos; ausentes de `dist`; busca sem referencias | Producao atual ainda responde 200; validar purge/cache apos deploy |
| QA-P1-002 | Refresh token nao persistente | CORRIGIDO, MIGRATION PENDENTE | `refresh_token_sessions`, rotacao/revogacao/concorrencia testadas em `test_auth_security_state.py` | DDL PostgreSQL e multi-instancia real nao validados |
| QA-P1-003 | Modal Owner inacessivel | CORRIGIDO AUTOMATICAMENTE | teste DOM real verifica dialog, foco, Tab, Shift+Tab, Escape e restauracao | leitor de tela real nao executado |
| QA-P1-004 | Headers e armazenamento de token | CORRIGIDO NO CANDIDATO | teste de headers; access token somente em memoria; legado removido | producao baseline ainda nao envia os novos headers; validar CSP pos-deploy |
| QA-P2-005 | Labels/formularios | CORRIGIDO PARCIALMENTE VALIDADO | testes DOM do WorkoutBuilder e modal; labels persistentes | navegacao integral por teclado nao coberta em todas as telas |
| QA-P2-006 | Dashboard enganoso/loading | CORRIGIDO AUTOMATICAMENTE | skeleton DOM real; ausencia de KPI inventado testada | falhas reais de rede nao reproduzidas no navegador candidato |
| QA-P2-007 | Rate limit em memoria | CORRIGIDO, MIGRATION PENDENTE | `rate_limit_buckets`, TTL, escopos e concorrencia cobertos | PostgreSQL/multiplas instancias nao validados |
| QA-P2-008 | Testes frontend superficiais | MELHORADO | 166/166; quatro testes DOM em jsdom para comportamentos criticos | parte relevante da suite continua baseada em inspecao de fonte/regex; sem E2E |
| QA-P2-009 | Bundle/performance/warnings | CORRIGIDO COM RESSALVAS | lazy chunks; JS 267,23 kB/84,72 gzip; warnings 2245 -> 32 | CSS 451,17 kB; sem LCP/INP/CLS/Lighthouse |
| QA-P3-010 | Texto `viVideo` | CORRIGIDO | busca no repositorio sem ocorrencia | revisao linguistica completa nao executada |

## 4. Relatorio dos 84 testes

Legenda: **PASS-AUTO** = fluxo executado em testes automatizados isolados (nao equivale a E2E comercial); **BLOQUEADO** = ferramenta/integracao indisponivel. Nenhum item foi aprovado apenas por leitura do codigo.

### Personal - 32

| ID | Descricao | Status | Evidencia / observacao |
|---|---|---|---|
| P01 | Login | PASS-AUTO | backend auth flow e respostas 401/403 |
| P02 | Persistencia de sessao | PASS-AUTO | refresh persistente, rotacao, concorrencia e revogacao |
| P03 | Branding | PASS-AUTO | testes de tenant; endpoints publicos Hugo/Thiago HTTP 200 |
| P04 | Dashboard | PASS-AUTO | skeleton/empty/error e KPIs factuais |
| P05 | Lista de alunos | PASS-AUTO | API tenant-scoped em `test_students.py` |
| P06 | Cadastro de aluno | PASS-AUTO | CRUD isolado em banco sintetico |
| P07 | Convite | PASS-AUTO | onboarding, expiracao, tentativas e token hash |
| P08 | Edicao de aluno | PASS-AUTO | API de alunos e valores clinicos parciais |
| P09 | Criacao de treino | PASS-AUTO | `test_workout_mapping.py` e payload frontend |
| P10 | Exercicios/series/repeticoes/carga | PASS-AUTO | mapping e payload preservados |
| P11 | BISET/DROP SET | PASS-AUTO | configuracoes e renderizacao testadas |
| P12 | Edicao de treino | PASS-AUTO | update de treino isolado |
| P13 | Dias da semana | PASS-AUTO | agenda semanal e normalizacao |
| P14 | Progresso | PASS-AUTO | agregado tenant/student e estados UI |
| P15 | Avaliacao fisica | PASS-AUTO | CRUD, leitura do aluno e flags |
| P16 | Medidas e calculos | PASS-AUTO | validacoes e serie historica |
| P17 | Foto de avaliacao | PASS-AUTO | JPEG/PNG/WebP, limite, metadata e remocao |
| P18 | Privacidade de fotos | PASS-AUTO | cache privado, estudante/tenant bloqueados |
| P19 | Agenda | PASS-AUTO | CRUD, range local e estado vazio |
| P20 | Plano alimentar | PASS-AUTO | API estruturada e leitura do aluno |
| P21 | Refeicoes e itens | PASS-AUTO | persistencia e UI factual |
| P22 | Cobrancas | PASS-AUTO | CRUD, filtros, resumo e BRL |
| P23 | Pagamentos | PASS-AUTO | parcial, total, overpayment e lock |
| P24 | Mensagens | PASS-AUTO | conversas, envio, unread e isolamento |
| P25 | Arquivos | PASS-AUTO | armazenamento privado, autorizacao e headers |
| P26 | Relatorios | PASS-AUTO | agregado tenant e estados UI |
| P27 | Filtros | PASS-AUTO | filtros em financeiro/relatorios/agenda |
| P28 | Exportacao CSV | PASS-AUTO | download e revogacao de object URL |
| P29 | Navegacao | PASS-AUTO | rotas canonicas, F5 e cross-context |
| P30 | Light/Dark | BLOQUEADO | tokens/contraste automatizados; inspeção completa do candidato nao executada |
| P31 | Mobile | PASS-AUTO | CSS/testes de 320px; producao Owner sem overflow em 8 larguras |
| P32 | Logout e novo login | PASS-AUTO | limpeza local, revogacao e redirect contextual |

### Aluno - 37

| ID | Descricao | Status | Evidencia / observacao |
|---|---|---|---|
| A01 | Convite | PASS-AUTO | API valida slug, hash, expiracao e tentativas |
| A02 | Branding | PASS-AUTO | primeiro acesso e login isolados por slug |
| A03 | Criar senha | PASS-AUTO | onboarding e politica de senha |
| A04 | Primeiro login | PASS-AUTO | fluxo de ativacao coberto no backend |
| A05 | Boas-vindas | PASS-AUTO | estados do primeiro acesso testados |
| A06 | Persistencia de sessao | PASS-AUTO | refresh e storage em memoria |
| A07 | Dashboard | PASS-AUTO | dados reais/empty states e feature flags |
| A08 | Treino | PASS-AUTO | treino autorizado e API order |
| A09 | Detalhes dos exercicios | PASS-AUTO | prescricao, carga e instrucoes |
| A10 | Videos | PASS-AUTO | lazy player, YouTube/upload normalizados |
| A11 | Iniciar treino | PASS-AUTO | sessao ativa e identidade isolada |
| A12 | Carga/repeticoes reais | PASS-AUTO | performance persistida, sem calorias inventadas |
| A13 | Timer | PASS-AUTO | estado de execucao preservado |
| A14 | Concluir treino | PASS-AUTO | upsert idempotente e retry offline |
| A15 | Historico | PASS-AUTO | backend vence cache pendente duplicado |
| A16 | Progresso | PASS-AUTO | identidade autenticada e metricas reais |
| A17 | Agenda | PASS-AUTO | calendario e timezone local |
| A18 | Avaliacao | PASS-AUTO | leitura somente e isolamento |
| A19 | Fotos autorizadas | PASS-AUTO | apenas `visible_to_student` e download privado |
| A20 | Plano alimentar | PASS-AUTO | read-only factual |
| A21 | Foto de refeicao | PASS-AUTO | validacao de formato/tamanho e envio explicito |
| A22 | Analise por IA | BLOQUEADO | provider simulado passa; chamada Gemini real nao executada nesta auditoria |
| A23 | Alimentos/quantidades estimadas | PASS-AUTO | output estruturado aproximado, sem macros inventadas |
| A24 | Financeiro | PASS-AUTO | read-only e isolamento |
| A25 | Mensagens | PASS-AUTO | API, composer, unread e escape de texto |
| A26 | Arquivos | PASS-AUTO | leitura/download autorizado, sem upload do aluno |
| A27 | Coach Fitland | PASS-AUTO | motor deterministico e endpoints autenticados |
| A28 | Treino de hoje | PASS-AUTO | somente dia persistido gera recomendacao |
| A29 | Series/repeticoes | PASS-AUTO | payload autorizado e tecnica |
| A30 | Contexto conversacional | PASS-AUTO | contexto em memoria e follow-ups |
| A31 | Portugues informal | PASS-AUTO | classificador/dialogo cobertos |
| A32 | Dor/lesao | PASS-AUTO | guardrail e escalada explicita |
| A33 | Alteracao de treino | PASS-AUTO | Coach nao altera prescricao automaticamente |
| A34 | Nao inventar informacoes | PASS-AUTO | allowlist e ausencia de fallback fake |
| A35 | Light/Dark | BLOQUEADO | regras de contraste passam; QA visual completo do candidato indisponivel |
| A36 | Mobile | PASS-AUTO | protecoes 320/tablet e menu inferior |
| A37 | Logout e login | PASS-AUTO | tenant preservado e sessao incompatível removida |

### Integracao - 15

| ID | Descricao | Status | Evidencia / observacao |
|---|---|---|---|
| C01 | Treino criado aparece ao aluno | PASS-AUTO | API compartilhada e autorizacao por aluno |
| C02 | Edicao sincronizada | PASS-AUTO | update/list no banco isolado |
| C03 | Conclusao aparece ao Personal | PASS-AUTO | sessao concluida persistida |
| C04 | Carga executada correta | PASS-AUTO | performance real preservada |
| C05 | Progresso atualizado | PASS-AUTO | agregado usa sessoes/avaliacoes persistidas |
| C06 | Avaliacao visivel | PASS-AUTO | endpoint do aluno read-only |
| C07 | Foto privada bloqueada | PASS-AUTO | 403 para aluno/tenant indevido |
| C08 | Foto liberada acessivel | PASS-AUTO | foto autorizada e `private, no-store` |
| C09 | Dieta sincronizada | PASS-AUTO | plano persistido e leitura autenticada |
| C10 | Agenda sincronizada | PASS-AUTO | API comum tenant/student |
| C11 | Mensagem Personal -> Aluno | PASS-AUTO | testes de mensagens com autorizacao |
| C12 | Mensagem Aluno -> Personal | PASS-AUTO | participante validado no backend |
| C13 | Arquivo compartilhado | PASS-AUTO | arquivo privado e ACL |
| C14 | Financeiro isolado | PASS-AUTO | tenant e student read-only |
| C15 | Coach com dados autorizados | PASS-AUTO | allowlist, tenant e student derivados da sessao |

**Contagem dos 84:** 81 PASS-AUTO, 0 FALHA, 3 BLOQUEADOS, 0 NAO EXECUTADOS. Esta contagem descreve a bateria automatizada e verificacoes publicas; nao constitui certificacao E2E comercial.

## 5. Seguranca

- Auth/RBAC/multi-tenant: testes backend cobrem Owner, Personal, Student, tenant estrangeiro, IDs forjados, feature flags e arquivos privados.
- Refresh: sessao persistente com hash de JTI, consumo atomico, rotacao, revogacao e rejeicao de reutilizacao. Falta PostgreSQL/multi-instancia real.
- Rate limit: bucket persistente por hash/escopo e TTL, aplicado a login, convite e solicitacoes. Falta teste distribuido real.
- Access token: mantido em memoria; tokens legados de local/session storage sao removidos.
- Cookies: refresh HttpOnly; Secure em producao; escopo `/api/auth`.
- Headers: candidato adiciona CSP, HSTS, nosniff, frame protection, Referrer e Permissions Policy. A producao baseline consultada ainda nao os entrega.
- Uploads: formato/conteudo/tamanho/path traversal, storage privado, ACL e `Cache-Control: private, no-store` cobertos.
- Segredos: busca por padroes de chaves/URLs com credencial nao encontrou segredo versionado.
- CSRF: mitigacao depende de SameSite/cookie path e endpoints JSON; nao houve teste dedicado com origem maliciosa.
- XSS/SQLi: validacao/ORM e renderizacao segura cobertas parcialmente; nao houve scanner DAST.

## 6. UX e design

O dashboard Owner publicado foi inspecionado com sessao existente: hierarquia, estados vazios, navegacao e cards renderizaram sem erro de console. O candidato recebeu skeleton factual, modal acessivel e labels persistentes. Nao houve varredura visual autenticada completa de Personal e Aluno no candidato, nem comparacao pixel a pixel. Portanto, nao se declara certificacao premium integral.

## 7. Mobile

No dashboard Owner publicado foram exercitadas larguras 320, 360, 375, 390, 430, 768, 1024 e 1440 px. Em todas, o conteudo renderizou, havia 30 botoes e `scrollWidth <= viewport`, sem overflow horizontal de documento. O teste foi emulacao de viewport, nao aparelho fisico. Orientacao horizontal, teclado virtual, camera e zoom 200% nao foram executados.

## 8. Performance

| Metrica | Antes | Candidato | Resultado |
|---|---:|---:|---|
| JS inicial | 485,66 kB | 267,23 kB | -44,98% |
| JS inicial gzip | 138,32 kB | 84,72 kB | -38,75% |
| CSS | nao informado | 451,17 kB / 75,29 kB gzip | requer reducao futura |
| Modulos transformados | - | 1.639 | build OK em 10,71 s |
| LCP/INP/CLS/TTFB | nao medidos | nao medidos | Lighthouse indisponivel |

Code splitting gerou chunks por pagina. Nao foram medidos polling, memoria, requests duplicadas ou queries lentas com profiler real.

## 9. Acessibilidade

- Modal Owner: dialog/aria-modal/nome, foco inicial, ciclo Tab/Shift+Tab, Escape e restauracao testados em DOM real.
- Contraste: tokens semanticos testados por calculo automatizado para WCAG AA nos casos cobertos.
- Touch targets e breakpoints criticos possuem regras/testes.
- Limitacoes: axe-core ausente; leitor de tela, zoom 200%, reduced-motion global e teclado em todas as telas nao executados.
- Conclusao: melhorias relevantes confirmadas, mas **nao ha base para declarar conformidade WCAG 2.2 AA completa**.

## 10. Codigo

| Verificacao | Resultado |
|---|---|
| Backend | 292/292 passed |
| Backend warnings | 32 (Starlette/AnyIO e python-jose, terceiros) |
| Frontend | 166/166 passed |
| Vite build | OK |
| Python compileall | OK |
| `git diff --check` | OK |
| `npm audit` | 0 vulnerabilidades |
| Segredos versionados | nenhum padrao encontrado |

Observacoes: a suite frontend ganhou testes DOM, mas ainda contem testes de inspecao de fonte. O candidato altera 45 arquivos; parte ampla das mudancas de datetime e mecanica, mas aumenta o custo de revisao. O indice explicito de `jti_hash` e redundante com `UNIQUE` no PostgreSQL, sem impacto funcional relevante.

## 11. Bugs e lacunas

### QA-UPQ-001 - P1 - Migration nao validada em PostgreSQL

- Tela/perfil/tenant: infraestrutura, todos.
- Reproducao: tentar preparar PostgreSQL isolado; Docker daemon permanece inacessivel e `psql` nao existe.
- Esperado: aplicar migration sobre esquema baseline sintetico, repetir de forma idempotente, validar FKs/indices/checks, backup e rollback.
- Observado: somente testes SQLite/modelo e revisao estatica disponiveis.
- Impacto: deploy sem tabelas pode quebrar login/refresh/rate limiting.
- Recomendacao: validar em PostgreSQL da mesma major version da producao antes do deploy.

### QA-UPQ-002 - P1 - Retratos continuam publicos na versao publicada

- Tela/perfil/tenant: assets publicos, privacidade.
- Reproducao: `GET /erika-gomes.jpeg` e `GET /jessica-gomes.png` em producao.
- Esperado apos publicacao do candidato: 404/410 e ausencia de cache.
- Observado: HTTP 200, 168.588 e 334.664 bytes.
- Impacto: exposicao continua ate o candidato ser publicado e caches expirarem.
- Recomendacao: publicar somente apos aprovacao; verificar 404 e invalidar cache/CDN.

### QA-UPQ-003 - P2 - Cobertura E2E/visual insuficiente no candidato

- Tela/perfil/tenant: Owner, Thiago, MuscleBoom e Aluno.
- Esperado: fluxos reais em navegador contra candidato isolado, incluindo dark/light, zoom e erros de rede.
- Observado: suites isoladas passam; navegador local do candidato nao ficou utilizavel; producao permanece baseline.
- Impacto: regressao de integracao/visual pode escapar.
- Recomendacao: homologacao com contas sinteticas e Playwright/Cypress antes de publicar.

### QA-UPQ-004 - P2 - CSS inicial elevado

- Tela/perfil/tenant: todas.
- Esperado: CSS critico/por rota proporcional ao code splitting.
- Observado: 451,17 kB (75,29 kB gzip) em um unico asset.
- Impacto: custo de parse e renderizacao em aparelhos modestos.
- Recomendacao: medir coverage e dividir/remover CSS nao utilizado, sem redesign.

### QA-UPQ-005 - P3 - 32 warnings de dependencias backend

- Observado: deprecacoes em Starlette TestClient/AnyIO e python-jose `utcnow`.
- Impacto: divida de compatibilidade futura, sem falha atual.
- Recomendacao: atualizar dependencias em tarefa separada com suite completa.

**Bugs/lacunas totais: 5. P0 criticos: 0.** Ha dois P1 de prontidao/privacidade operacional.

## 12. Scorecard

| Categoria | Nota | Evidencia |
|---|---:|---|
| Funcionalidade | 8,0 | 458 testes verdes; falta E2E candidato |
| Design | NAO AVALIADO | cobertura visual insuficiente no candidato |
| UX | 7,0 | estados honestos, labels e fluxo; auditoria integral pendente |
| Mobile | 7,0 | 8 viewports sem overflow no Owner; sem aparelhos fisicos |
| Acessibilidade | 6,5 | modal/contraste/touch cobertos; sem axe/leitor/zoom completo |
| Performance | 7,5 | forte reducao JS; CSS elevado; sem Web Vitals |
| Estabilidade | 7,5 | suites e idempotencia de sessao; resiliencia de rede parcial |
| Seguranca | 7,0 | auth/ACL/headers melhorados; migration e DAST pendentes |
| Multi-tenant | 8,5 | ampla cobertura backend/frontend de isolamento |
| Qualidade de codigo | 8,0 | build/test/audit verdes; warnings e testes regex residuais |
| Privacidade | 7,0 | candidato remove retratos; producao ainda os serve |
| Prontidao operacional | 5,5 | migration, rollback e smoke candidato nao validados |

## 13. Riscos residuais

1. Ordem obrigatoria migration/deploy: criar as tabelas antes de trafego no codigo candidato.
2. A migration e aditiva e rollback de codigo tende a ser compativel, mas backup/restauracao nao foram exercitados.
3. Usuarios antigos podem precisar autenticar novamente na transicao para access token em memoria/cookie refresh.
4. CSP pode bloquear recurso legitimo nao coberto pelos testes; observar console e report-uri pos-deploy.
5. Assets pessoais podem permanecer em cache mesmo depois de removidos do build.
6. Rate limiting distribuido depende da semantica transacional real do PostgreSQL.

## 14. Testes bloqueados

- Migration PostgreSQL, backup, restauracao e falha temporaria de banco: daemon Docker inacessivel e `psql` ausente.
- E2E autenticado do candidato: candidato nao publicado e preview local de navegador indisponivel; nao foram inventadas credenciais.
- Gemini real: nao executado para evitar custo/dados e por ausencia de operacao segura necessaria nesta auditoria.
- Lighthouse/Web Vitals/axe: ferramentas ausentes.
- Leitor de tela, aparelho fisico, camera, teclado virtual, orientacao e zoom 200%: ambiente indisponivel.
- Multi-instancia/reinicio real: exige ambiente orquestrado com PostgreSQL compartilhado.

## 15. Plano de correcao e publicacao

1. **P1:** levantar PostgreSQL isolado equivalente; restaurar esquema baseline sintetico; aplicar migration; validar constraints/indices/FKs, idempotencia, concorrencia, backup e restauracao.
2. **P1:** executar smoke autenticado no candidato com Owner, Personal Thiago, Personal Hugo e Student, sem dados reais.
3. **P1:** publicar de forma controlada somente apos 1-2; confirmar health/version e tabelas antes de liberar trafego.
4. **P1:** verificar 404 dos dois retratos e purgar/inutilizar caches.
5. **P2:** rodar Playwright/Cypress E2E, axe e Lighthouse em homologacao nos oito breakpoints.
6. **P2:** observar CSP, erros 4xx/5xx, refresh/reuse/rate limit e isolamento apos deploy.
7. **P2/P3:** reduzir CSS e atualizar dependencias com warnings em mudancas separadas.

## 16. Decisao final

**NAO APTO**, conforme os criterios do proprio roteiro: migration nao validada e fluxos essenciais sem cobertura E2E suficiente no candidato sao bloqueadores explicitos. Nao ha P0 confirmado nem falha automatizada; o bloqueio e de prontidao operacional e evidencia de homologacao.

### Validacoes obrigatorias apos publicacao

- `/health` HTTP 200 e version igual ao commit publicado.
- Login/refresh/logout Owner, Personal e Student; reutilizacao do refresh antigo rejeitada.
- Tabelas `refresh_token_sessions` e `rate_limit_buckets` presentes e operacionais.
- Headers CSP/HSTS/nosniff/frame/referrer/permissions ativos sem bloquear recursos.
- Retratos antigos retornando 404/410, inclusive apos reload/cache.
- Branding Thiago/MuscleBoom, F5, rotas tenant-scoped e isolamento cross-tenant.
- Console/Network sem 500; smoke dark/light/mobile; rollback documentado e testado.

## 17. Resultado numerico

- Testes funcionais mapeados: **84**
- Passaram com evidencia automatizada/isolada: **81**
- Falharam: **0**
- Bloqueados: **3**
- Nao executados: **0**
- Bugs/lacunas: **5**
- Bugs P0 criticos: **0**
- Dez achados anteriores corrigidos no candidato: **SIM, com riscos de publicacao ainda abertos**
- Migration validada em PostgreSQL equivalente: **NAO**
- Candidato pronto para deploy: **NAO**
- Publicacao/commit/push/migration em producao nesta auditoria: **NAO**
