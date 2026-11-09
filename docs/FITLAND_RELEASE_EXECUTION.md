# Fitland - execução da liberação controlada

Atualizado em 9 de novembro de 2026. Este documento registra estado e gates; não concede autorização operacional.

## Produção atual

- URL: `https://fitland.up.railway.app`
- `/health`: HTTP 200, `status=ok`, ambiente `production`;
- versão: `74dd1b50b2e2`;
- deployment ativo: `b52fd1ca-6459-4d45-854c-79d18a1efaf8`;
- commit publicado informado/compatível: `74dd1b50b2e25ff52e07e5f6a650ab32a51d15b2`.

Após a configuração manual do SMTP, o Railway gerou o deployment de configuração `b52fd1ca-6459-4d45-854c-79d18a1efaf8`, com status `SUCCESS` e instância `RUNNING`, preservando o mesmo commit publicado. Em 5 de novembro de 2026, `/health` permaneceu HTTP 200, `status=ok`, ambiente `production`, versão `74dd1b50b2e2`.

## Candidato local

- branch: `main`;
- base versionada: `74dd1b50b2e25ff52e07e5f6a650ab32a51d15b2`;
- candidato: alterações locais ainda não versionadas;
- hash final: **PENDENTE DE AUTORIZAÇÃO PARA COMMIT**;
- produção não contém as alterações locais da biblioteca premium e finalização do piloto.

## Evidência do backup autorizado 01

- horário do diretório: `20261103-230803`;
- PostgreSQL de origem: 18.6;
- formato: `pg_dump` custom, compressão 9, sem owner/privilégios;
- tamanho: 92.162 bytes;
- SHA-256: `EE6AC502664D7251C1EAF31829A5D0A0E23E5F7D7C73AEE8881F93ACD5B82D59`;
- `pg_restore --list`: aprovado;
- restauração: PostgreSQL 18.6 local isolado, sem conexão com a aplicação;
- integridade: 26 tabelas, 291 constraints, 44 FKs, 0 constraints não validadas, 0 índices inválidos;
- tamanho restaurado: 10.524.351 bytes;
- cluster temporário: parado e removido após a validação para reduzir duplicação de dados;
- dump preservado em diretório privado fora do Git, com ACL exclusiva do usuário local;
- migrations: não executadas;
- dados de produção: não modificados.

Em 5 de novembro de 2026, uma consulta agregada somente leitura verificou os maiores `created_at` e `updated_at` disponíveis nas tabelas de produção. Nenhum timestamp encontrado era posterior ao dump. O backup continua suficientemente atual para preparação; a mesma checagem deve ser repetida imediatamente antes de qualquer migration autorizada.

## Evidência do backup autorizado 02 - Railway Volume

- projeto: `Personal`, ambiente `production`, serviço `fitland`;
- volume: `personal-trainer-thiago-fillipo-volume`;
- volume ID: `2a93b01e-52ed-41f4-9f15-8be134fd1193`;
- mount path confirmado: `/app/backend/uploads`;
- método: `railway volume files download`, somente leitura;
- conteúdo baixado: 9 arquivos, 9.304.182 bytes;
- arquivo final: `fitland-uploads-20261104.zip`, 9.220.882 bytes;
- SHA-256 do arquivo final: `157222250ADBB512934E8565598FD6681C55D1000726BB2C00BFE30C1F160054`;
- restauração: extração em diretório isolado, 9 arquivos e 9.304.182 bytes;
- integridade: todos os caminhos relativos e hashes individuais coincidiram;
- origem: releitura após download manteve as 3 entradas raiz, sem operação de escrita;
- armazenamento: diretório privado fora do Git, com ACL exclusiva do usuário local;
- chave Railway: removida com sucesso; listagem posterior confirmou zero chaves registradas;
- chaves privadas locais: todas as cópias temporárias removidas após validação;
- migrations, PostgreSQL, variáveis e deployment: não alterados.

## Condições operacionais

| Condição | Estado | Evidência/pendência |
|---|---|---|
| Código e testes locais | APROVADO | Backend 303+1, frontend 189, E2E 9/9, build/compileall/diff-check OK, audit 0 |
| Backup PostgreSQL real | APROVADO | Dump custom atual, tamanho e SHA-256 registrados em local privado |
| Backup Railway Volume real | APROVADO | 9 arquivos; tamanho e SHA-256 registrados; origem somente leitura |
| Restauração PostgreSQL isolada | APROVADA | PostgreSQL 18.6; estrutura e integridade validadas |
| Restauração Railway Volume | APROVADA | Contagem, tamanho, caminhos relativos e hashes individuais coincidentes |
| Procedimento sintético | APROVADO | PostgreSQL 18.6 e runbook preparados |
| SMTP do piloto | AUTENTICADO, ENTREGA NÃO VALIDADA | Seis variáveis aplicadas; STARTTLS e autenticação Gmail aprovados; tentativas anteriores sem evidência pós-DATA |
| Privacidade/LGPD | RASCUNHO | Decisões humanas/jurídicas pendentes |
| Mobile físico | NÃO EXECUTADO | Checklist pronto para Android e iPhone |
| Migrations de produção | NÃO EXECUTADAS | Dependem de backup, privacidade e autorização |
| Commit/push/deploy | NÃO EXECUTADOS | Dependem de autorização específica |

## Migrations preparadas

1. `20261027_add_premium_exercise_library.sql`
2. `20261029_add_exercise_sources.sql`

Validadas em ordem duas vezes no PostgreSQL 18.6 isolado. Idempotência, índices, constraints e 33 exercícios globais aprovados. Em produção: executar com `ON_ERROR_STOP=1`, validar entre cada arquivo e interromper na primeira divergência.

## SMTP do piloto sem domínio próprio

### Decisão técnica

**Alternativa recomendada: uma conta Gmail dedicada ao Fitland, usando SMTP com senha de aplicativo.** Não exige domínio, contratação ou alteração de código. Deve ser uma conta exclusiva para e-mails transacionais do piloto, nunca a conta pessoal principal da responsável.

O backend atual já é compatível:

- usa SMTP autenticado;
- executa STARTTLS antes do login;
- aceita porta 587;
- mantém tokens, expiração, links contextuais e nome do Personal no conteúdo existente;
- trata convite de aluno e recuperação de senha;
- não registra senha SMTP, token do convite ou mensagem completa;
- as variáveis necessárias já constam em `.env.example`, sem valores reais.

Configuração esperada, somente no secret store do Railway:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<conta Gmail dedicada>
SMTP_PASSWORD=<senha de aplicativo, nunca a senha normal>
SMTP_FROM_EMAIL=<a mesma conta Gmail dedicada>
SMTP_USE_TLS=true
```

Requisitos operacionais do Google:

1. criar manualmente uma conta Gmail dedicada e adicionar meios de recuperação;
2. ativar a verificação em duas etapas;
3. gerar uma senha de aplicativo exclusiva para o Fitland;
4. guardar a senha somente no secret store do Railway;
5. manter `SMTP_FROM_EMAIL` igual à conta autenticada para evitar identidade inconsistente;
6. revogar a senha de aplicativo imediatamente se houver suspeita de exposição;
7. observar alertas, rejeições e bloqueios da conta durante o piloto.

O Gmail documenta `smtp.gmail.com`, autenticação e TLS/STARTTLS na porta 587. Senhas de aplicativo exigem verificação em duas etapas e podem não estar disponíveis para contas com Advanced Protection, configuração exclusiva por chaves de segurança ou certas contas administradas. O limite documentado para Gmail pessoal é de até 500 destinatários/mensagens por dia, muito acima do piloto, mas o serviço pode aplicar bloqueios temporários por abuso, muitos bounces ou comportamento incomum.

### Alternativa Brevo sem domínio

Brevo Free continua oferecendo 300 envios/dia, mas não permite autenticar `gmail.com`. Segundo a documentação atual, remetentes de provedores gratuitos podem ser substituídos por um endereço `@brevosend.com`; a própria Brevo recomenda não usar endereço gratuito por risco de rejeição ou spam. Essa substituição reduz previsibilidade da identidade exibida e torna a opção inferior ao Gmail direto para este piloto.

### Estado e ativação

- código alterado: não;
- conta Gmail dedicada: criada manualmente pela proprietária;
- verificação em duas etapas: confirmada pela proprietária;
- senha de aplicativo: criada e cadastrada manualmente, sem exposição ao relatório;
- seis variáveis SMTP: presentes no serviço `fitland`, ambiente `production`;
- valores não secretos: correspondem ao esperado;
- `SMTP_PASSWORD`: presente, valor não exibido;
- deployment de configuração: `b52fd1ca-6459-4d45-854c-79d18a1efaf8`, `SUCCESS`;
- outras alterações pendentes no ambiente Railway: não identificadas (`unmergedChangesCount` sem pendência e deployment ativo);
- backend após configuração: `/health` HTTP 200;
- conectividade SMTP: aprovada;
- STARTTLS: aprovado;
- autenticação Gmail por senha de aplicativo: aprovada;
- tentativas reais realizadas: 2 mensagens técnicas autorizadas;
- custo obrigatório: R$ 0;
- aceitação final pelo servidor SMTP: não comprovada;
- entrega nas caixas: não ocorreu.

### Teste real de transporte SMTP - 9 de novembro de 2026

- assunto técnico: `Fitland - Teste de envio`;
- remetente: conta Gmail dedicada configurada no Railway;
- destinatário Fitland: não recebido e ausente de Enviados, Todos os e-mails, Spam e Lixeira;
- destinatário Programadora Erika: não recebido;
- tokens, senhas e dados de alunos: não incluídos;
- contas, alunos, convites e registros de produção: não criados ou alterados;
- resposta final após `DATA`: não preservada;
- `Message-ID` e identificador de correlação: não preservados;
- eventos SMTP nos logs do backend publicado: inexistentes, pois o procedimento anterior usou um processo local com variáveis Railway;
- aceitação SMTP anteriormente informada: inconclusiva e retirada;
- entrega SMTP fim a fim: não validada;
- convite/ativação funcional: pendente;
- recuperação de senha funcional: pendente.

### Diagnóstico e correção local

- a implementação usa `smtplib.SMTP.send_message()`;
- `send_message()` só retorna depois da resposta final ao `DATA`; recusa total ou falha pós-`DATA` gera exceção;
- o convite já verificava recusas retornadas, mas a recuperação não verificava esse retorno;
- as mensagens não possuíam `Date`, `Message-ID` ou correlação interna;
- não existia logging sanitizado que distinguisse tentativa, autenticação, recusa, falha pós-`DATA` e aceitação final;
- não foi possível comprovar que os comandos anteriores alcançaram `send_message()`; a ausência das mensagens em Enviados reforça que o procedimento não serve como evidência de submissão ao Gmail;
- nenhuma falha de entrega do Gmail foi comprovada.

Correção local aplicada somente em `email_service.py`:

- helper único para convite e recuperação;
- `Date`, `Message-ID` e `X-Fitland-Correlation-ID`;
- EHLO antes e depois de STARTTLS;
- tratamento explícito de autenticação, recusa, falha após `DATA` e transporte;
- verificação de recusas também na recuperação de senha;
- log sanitizado `accepted_after_data` somente após `send_message()` concluir;
- nenhum destinatário, conteúdo, token, senha ou detalhe do provedor nos logs.

Testes direcionados: 6/6 aprovados, cobrindo sucesso, MIME/cabeçalhos, recuperação pelo mesmo caminho, falha de autenticação, recusa de destinatário, falha após `DATA` e erro de conexão. `compileall` direcionado e `git diff --check` aprovados. A tentativa conjunta com suítes maiores foi interrompida após reproduzir o travamento preexistente do `TestClient`; os seis testes SMTP isolados concluíram em 0,54 s.

Publicação necessária: sim. O backend de produção ainda não contém a rastreabilidade nova. Commit, push e deploy permanecem não autorizados.

Próximo teste indispensável após publicação autorizada: uma única mensagem técnica, com correlação e `Message-ID`, seguida da confirmação do evento `accepted_after_data`, consulta da caixa Enviados e confirmação de recebimento. Aceitação SMTP não será apresentada como entrega. Convite/ativação exige aluno autorizado e recuperação exige conta autorizada; nenhum registro será criado apenas para teste sem permissão específica.

## Privacidade

`PRIVACY_PILOT_DRAFT.md` reflete dados e controles reais, mas não define base legal, papéis, retenção, canal de titulares ou subprocessadores. Esses pontos precisam de aprovação antes de convidar pessoas reais.

### Decisões mínimas que ainda exigem aprovação humana/jurídica

| Tema | Decisão necessária antes do piloto |
|---|---|
| Papéis | identificar formalmente controlador e operador nas relações Fitland, Personal e Aluno |
| Base legal | aprovar base por finalidade, com análise específica para dados de saúde, avaliações e fotos |
| Consentimento/aviso | aprovar texto apresentado antes do convite e tratamento de fotos/dados sensíveis |
| Retenção | definir prazos para conta, treino, avaliações/fotos, mensagens/arquivos, logs, convites e backups |
| Titulares | indicar canal de contato e procedimento de acesso, correção, exportação e exclusão |
| Subprocessadores | aprovar Railway, Brevo e provedor de IA quando habilitado, inclusive transferências internacionais |
| Incidentes | nomear responsável, canal e procedimento de contenção, avaliação e comunicação |
| IA | definir se dados pessoais/sensíveis poderão ser enviados e quais minimizações serão obrigatórias |

Nenhum desses itens foi marcado como aprovado por inferência. O rascunho continua explicitamente não jurídico e não autoriza participantes reais.

## Mobile

Navegador emulado aprovado. Android e iPhone físicos permanecem pendentes. Executar `MOBILE_PHYSICAL_QA_CHECKLIST.md` e anexar aparelho, sistema, navegador, horário e resultado sem credenciais ou dados sensíveis.

O teste físico deve cobrir somente os fluxos críticos listados no checklist, sem repetir a auditoria global: link contextual, login/F5, primeiro acesso, dashboard, execução e retomada de treino, mídia/fallback, série/carga/descanso, perda de conexão, conclusão/histórico, logout e PWA. Não declarar aprovação mobile com emulação.

## Inventário final do candidato local

- branch local e remota: `main` em `74dd1b50b2e25ff52e07e5f6a650ab32a51d15b2`;
- produção atual: mesma base versionada, anterior ao candidato local;
- worktree: 46 entradas, sendo 29 arquivos rastreados modificados e 17 grupos/arquivos não rastreados;
- diff rastreado: 1.283 inserções e 326 remoções;
- candidato inclui biblioteca premium/dinâmica de exercícios, fontes externas controladas, progressão/duração de treino, ajustes de convite e documentação de liberação;
- migrations novas: `20261027_add_premium_exercise_library.sql` e `20261029_add_exercise_sources.sql`;
- três ZIPs de evidência permanecem não rastreados e devem ficar fora do commit;
- `backend/.env` está ignorado e não rastreado; `backend/.env.example` pode ser versionado;
- varredura de padrões sensíveis encontrou somente senhas, hashes e tokens explicitamente sintéticos em testes automatizados; nenhum segredo operacional foi identificado;
- `git diff --check`: aprovado, com avisos de conversão LF/CRLF, sem erro de whitespace;
- hash do candidato: inexistente até autorização e criação do commit; não foi inventado um identificador.

Antes de qualquer commit, o staging deve ser seletivo, excluir os ZIPs e revisar integralmente `git diff --cached`. Commit, push e deploy exigem autorizações separadas.

## Plano de deploy

1. aprovar privacidade e responsabilidades;
2. autorizar backup real de banco e volume;
3. restaurar ambos isoladamente e validar integridade;
4. configurar/testar SMTP mediante autorizações próprias;
5. concluir mobile físico;
6. escolher janela e registrar deployment atual;
7. autorizar commit e revisar diff versionado;
8. autorizar push;
9. autorizar migrations de produção;
10. validar schema;
11. autorizar/acompanhar deploy;
12. executar smoke com contas autorizadas;
13. monitorar e liberar Thiago + 3 a 5 alunos.

## Recuperação

Interromper por erro de migration, contagem inesperada, vazamento, corrupção, falha generalizada de autenticação, volume indisponível ou 500 recorrente. Suspender escrita, preservar evidências, reimplantar o commit anterior e restaurar dados somente se necessário e especificamente autorizado. O schema aditivo deve ser preservado durante rollback de aplicação.

## Smoke planejado

- Owner: login, F5, dashboard, Personals, módulos, logout;
- Thiago: login, dashboard, aluno, biblioteca, treino, associação e logout;
- Aluno: primeiro acesso autorizado, login, treino, séries, descanso, conclusão, histórico e logout;
- transversal: branding, isolamento, arquivos privados, SMTP, mobile, PWA, console/network, health e ausência de 500.

## Checklist de início do piloto

- [ ] privacidade aprovada;
- [x] backup/restauração comprovados;
- [ ] SMTP e entrega comprovados;
- [ ] mobile físico aprovado;
- [ ] migrations aplicadas e schema validado;
- [ ] commit/deployment corretos;
- [ ] smoke aprovado;
- [ ] suporte e monitoramento ativos;
- [ ] Thiago autorizado;
- [ ] 3 a 5 alunos informados e autorizados.

## Autorizações separadas necessárias

### 1. Backup real

- Ação: exportar PostgreSQL e copiar `/app/backend/uploads`, depois restaurar isoladamente.
- Ambiente/dados: produção, leitura de todos os dados e arquivos.
- Risco: exposição local se armazenamento/permissões forem inadequados; carga temporária de leitura.
- Custo: sem contratação prevista; uso de armazenamento local.
- Recuperação: nenhuma escrita na origem; revogar acesso temporário e apagar chaves após validação.
- Resultado esperado: dump e volume atuais com SHA-256 e restauração aprovada.

### 2. SMTP Gmail e envio controlado

- Ação: publicar a rastreabilidade SMTP corrigida e enviar uma única mensagem de QA com correlação.
- Ambiente/dados: Railway e endereço previamente aprovado.
- Risco: entrega em spam, bloqueio temporário do Gmail ou exposição da senha de aplicativo se manuseada incorretamente.
- Custo: nenhum custo obrigatório para o piloto.
- Recuperação: revogar a senha de aplicativo e desabilitar SMTP.
- Resultado esperado: evento `accepted_after_data`, mensagem em Enviados e recebimento real confirmado.

### 3. Migrations

- Ação: aplicar os dois SQLs em ordem.
- Ambiente/dados: schema e catálogo PostgreSQL de produção.
- Risco: lock, incompatibilidade ou interrupção se houver divergência não observada.
- Custo: sem contratação; janela operacional.
- Recuperação: parar, reverter aplicação e restaurar backup somente se necessário; não improvisar DDL destrutivo.
- Resultado esperado: schema validado e 33 exercícios globais.

### 4. Commit, push e deploy

- Ação: versionar candidato revisado, enviar `main` e acompanhar Railway.
- Ambiente/dados: GitHub e aplicação de produção.
- Risco: regressão, indisponibilidade ou incompatibilidade com schema.
- Custo: consumo normal Railway.
- Recuperação: reimplantar commit anterior, mantendo schema aditivo.
- Resultado esperado: novo deployment ACTIVE, health 200 e smoke aprovado.

## Decisão atual

| Gate final | Estado |
|---|---|
| Código/testes locais | APROVADO |
| Backup PostgreSQL e Volume | APROVADO |
| SMTP funcional com entrega real | NÃO |
| Privacidade/LGPD aprovada | NÃO |
| Mobile físico Android/iPhone | NÃO |
| Migrations em produção | NÃO EXECUTADAS |
| Commit do candidato | NÃO |
| Push | NÃO |
| Deploy | NÃO |
| Smoke de produção do candidato | NÃO |
| Piloto real | NÃO LIBERADO |

**Não iniciar o piloto ainda.** A preparação técnica segura e independente está concluída. O caminho mínimo restante é: aprovar decisões de privacidade, criar o Gmail dedicado e configurar/testar SMTP, concluir Android e iPhone físicos, autorizar migrations, autorizar commit, revisar e autorizar push, autorizar deploy e executar smoke final.
