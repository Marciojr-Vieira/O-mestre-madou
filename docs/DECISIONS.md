# Decisões

## ADR-018 — Recuperação publicada e demonstração completa (13/10/2026)

O usuário pediu correção dos erros 502, dados de produção na demonstração e credenciais de ADM. O erro público foi reproduzido: Runtime.UserCodeSyntaxError antes de conectar ao PostgreSQL. A correção CommonJS da ADR-017 será publicada no site Netlify a939522a-deb6-4d2f-b9e1-e05bc32f2e38, autenticado pelo proprietário. O site está atualmente vinculado ao repositório Marciojr-Vieira/O-mestre-madou; a conta brn-mascarenhas não é o destino autorizado.

Criado elo_full_demo a partir de snapshot consistente de elo, sem alterar os schemas anteriores. Oito contas da origem são fictícias. Copiadas 25 tabelas de negócio/configuração, com igualdade de registros, ordem por dependências, valores originais de identidade e atualização de sequências. Carteiras reconstruídas exclusivamente pelo ledger, com verificação dos saldos e slots. Sessões de autenticação e desafios OTP foram excluídos. Backup privado preservado. Criada conta pessoal de ADM com senha aleatória e credenciais em arquivo ignorado pelo Git. Perfis privados de demonstração passaram ao novo schema; perfil real foi preservado.

## ADR-017 — Entrada CommonJS da API no Lambda (13/10/2026)

O site publicado retornou 502 em `/v1/health`, com `Runtime.UserCodeSyntaxError: Unexpected token 'export'`. A inspeção do ZIP anterior confirmou `api.js` na raiz com `export { handler } from './functions/api.mjs'`, sem declaração de tipo ESM na raiz. A falha ocorre no carregamento do Lambda, antes da inicialização NestJS ou conexão PostgreSQL.

O preparador passa a gerar `functions/api.cjs` com exportação CommonJS, alinhada à compilação TypeScript da API, e remove o wrapper antigo `api.mjs` em builds incrementais. As opções de empacotamento continuam no `netlify.toml`. Teste de regressão executa o preparador em diretório temporário e carrega uma entrada Lambda CommonJS com o wrapper gerado e runtime isolado. Regras financeiras, banco e migrations permanecem preservados. Publicação remota depende de autenticação Netlify; a correção local precisa de novo deploy para chegar ao site.

Validação: lint, TypeScript, 39 testes, build web e API aprovados. O empacotador oficial gerou ZIP com entrada `module.exports = require('./functions/api.cjs')`. O ZIP extraído foi executado pela entrada api.js contra Supabase: health, catálogo e opções retornaram 200; catálogo com 111 serviços; refresh anônimo 401. DEMO_MODE foi desativado somente no processo de verificação para evitar seed; os perfis privados de publicação não foram alterados.

## ADR-016 — Código no GitHub para deploy pelo Netlify (11/10/2026)

O usuário solicitou hospedar o código no GitHub para conectar o projeto ao Netlify. Conta autenticada: brn-mascarenhas. Repositório proposto: o-mestre-mandou, privado. Enviar código, imagens públicas, migrations, testes, documentação e modelos de variáveis; excluir credenciais, bancos locais, dependências e pacotes gerados. Variáveis privadas continuam sendo importadas separadamente no Netlify. O conector disponível permite escrita de arquivos, mas não cria repositórios; essa criação foi solicitada ao proprietário antes do envio.

## ADR-015 — Demonstração online no Netlify (11/10/2026)

Endereço confirmado pelo usuário: https://o-mestre-mandou.netlify.app. APP_URL e WEB_ORIGIN dos arquivos privados NETLIFY.env e NETLIFY.demo.env foram atualizadas para essa origem. A origem localhost do desenvolvimento foi preservada. Publicação remota continua pendente da autenticação Netlify.

O usuário pediu que a versão atual funcione como demonstração no Netlify enquanto recebe modificações. Esta decisão substitui o bloqueio geral de demonstração na execução otimizada descrito nas ADR-013/014. NODE_ENV=production indica o runtime otimizado, não necessariamente uma operação com dados reais. A API aceita DEMO_MODE=true hospedado somente com PostgreSQL, segredo JWT persistente e schema com sufixo _demo; o adaptador Netlify também exige migrations previamente aplicadas.

NETLIFY.env passa a selecionar elo_demo, já preparado na Supabase. O gerador preserva perfis privados demo/production com segredos JWT diferentes e permite informar --mode. Dados e controle dos atalhos persistem entre deploys. O ADM mantém a opção de ocultar/reativar atalhos; o schema elo permanece protegido contra habilitação de demonstração. O ambiente local e a demonstração online compartilham elo_demo. Nenhum SMS, cobrança ou importação de dados reais foi adicionado.

Validação: 38 testes, lint e TypeScript aprovados; build oficial Netlify offline concluído. O ZIP final da API foi extraído e executado com NODE_ENV=production contra a Supabase. Catálogo, três perfis rápidos, cookies Secure/HttpOnly/SameSite, rotação de sessão e desativação/reativação pelo ADM passaram. Atalhos foram restaurados ao estado inicial e sessões de teste encerradas. O mesmo pacote com perfil real recusou login de demonstração. Publicação remota ainda não executada por falta de autenticação Netlify e URL definitiva.

## ADR-012 — Estudo de organização dos pagamentos (08/10/2026)

Pedido do usuário: estudar e apresentar um método completo para métodos de pagamento. Proposta registrada em [PAYMENTS.md](PAYMENTS.md), sem alteração de cobranças, banco ou credenciais. Separar compra de moedas, contratação de Preço Fechado e futura assinatura; manter ledger imutável e preservar desbloqueio, preço congelado e quatro contatos.

Direção proposta: começar com um provedor, Pix/cartão por checkout hospedado, confirmação autenticada e verificada, caixa de entrada/outbox, devoluções monetárias, contestações e conciliação. Asaas é candidato preliminar, condicionado à aceitação comercial dos créditos e à homologação; nenhum provedor, tarifa ou comissão foi aprovado ou contratado por este estudo. Split não implica retenção até conclusão. Checkout de serviços exige onboarding e regras próprias; capacidade de custódia/repasse condicionado depende do contrato do provedor.

O documento inclui organização dos módulos/dados, operação administrativa, segurança, matriz de testes e etapas de implantação. Integrações reais continuam pendentes; a proposta não comprova prontidão para produção.

## ADR-011 — Execução manual e importação do histórico local (08/10/2026)

Pedido explícito: guia de comandos para VS Code, aplicativo apontado à Supabase e importação também dos registros locais, confirmada pelo usuário. O .env local já apontava para o projeto correto; a instância existente em 3000/4000 foi preservada. O exemplo de ambiente passa a usar Supabase por padrão; o guia cobre execução conjunta e API/site em terminais separados, com tarefas do VS Code sem credenciais.

O PGlite recuperado foi copiado para um novo snapshot em .data antes da leitura, sem aplicar migrations ao original. Export privado em .data/local-import-20261008.json, ignorado pelo Git. O importador scripts/import-local.ts valida o ledger/counters locais, mapeia catálogo por chaves naturais e contas pelo e-mail, recusando identidades incompatíveis. Perfis, catálogo e regras de preço atuais da Supabase não são sobrescritos. Pedidos históricos são preservados como registros próprios, inclusive pedidos de demonstração semelhantes aos já existentes.

Importação em uma transação PostgreSQL, com advisory lock por origem. IDs são remapeados, incluindo respostas, referências do ledger, resultados idempotentes e payloads de notificações. Os seis bônus de demonstração são reutilizados somente quando pro, tipo, valor e ausência de referências coincidem. Um novo débito é inserido no ledger; trigger calcula o saldo. Nenhuma carteira recebe UPDATE direto. São conferidos saldos/ledger e slots/desbloqueios antes do commit.

Audit_logs recebe marcador com origem, hash, contagens e mapas de IDs; o hash diferente para a mesma origem é recusado. Duas execuções concorrentes no PostgreSQL real resultaram em uma importação e uma repetição sem escrita. Foram importados sete pedidos, 42 leads, 12 respostas, 43 notificações, duas sessões e um lançamento; oito contas e seis créditos correspondentes foram reaproveitados. O importador é específico para o snapshot inspecionado e recusa novas tabelas com dados sem mapeamento, em vez de omiti-los. Banco original, cópia recuperada e snapshot ficam preservados.

## ADR-010 — Supabase privada e conexão PostgreSQL verificada (07/10/2026)

O usuário confirmou o projeto `catfliwcaezqtgakaxwa`, autorizou o MCP e pediu configuração integral do banco. Mantemos a autenticação NestJS e as regras transacionais existentes. O novo banco estava sem tabelas de aplicação; migrations e seeds foram aplicados pelo MCP no schema privado `elo`, preservando auth/storage e os arquivos de migração anteriores. O histórico local registra cada arquivo e a Supabase registra as duas operações de implantação.

RLS e privilégios mínimos para `elo_runtime`; browser/API HTTP da Supabase sem acesso às tabelas. O trigger é o único caminho de alteração do saldo, com SECURITY DEFINER e search_path fixo. A credencial administrativa permanece necessária para migrações; em execução, SET ROLE restringe a conexão. Para produção, substituir a credencial administrativa por um login dedicado com esse papel é uma etapa operacional adicional. A migration 0005 revoga acesso público à função de evento preexistente da Supabase, sem modificar seu corpo ou gatilho.

Conexão nativa usa TLS verificado, pool limitado, timeout e tipos bigint seguros. Migrações são serializadas por advisory lock e aplicadas em transações. Testes externos usam schemas temporários aleatórios, incluindo migrações simultâneas, fluxo HTTP, RLS, ledger, idempotência e concorrência financeira. Nenhum registro do banco embarcado foi migrado silenciosamente.

A URI direta resolve apenas para IPv6 e falhou nesta rede. A conexão foi concluída pelo Session pooler `aws-1-ca-central-1.pooler.supabase.com:5432`, no projeto confirmado, com certificado Supabase Root 2021 CA e TLS verificado. A senha recém-informada foi recusada; a credencial anterior fornecida para o mesmo projeto foi validada e mantida somente no `.env` ignorado. Nenhuma credencial do projeto alternativo foi usada para alterar seu banco.

A validação real mostrou que o pooler ignora o parâmetro de startup `role`. Agora o hook assíncrono `onConnect` configura search_path, timeout, application_name e SET ROLE em toda conexão física antes de disponibilizá-la. Verifica current_user e recusa a conexão se o papel esperado não estiver ativo. Isso também protege conexões substituídas após erros SQL. O teste de segurança usa um pool com papel restrito e confirma sua permanência após erros; o teste de navegador usa conexão fixada em transação e membership explícito, necessário porque postgres da Supabase não é superusuário.

Catálogo HTTP deixou de executar 111 consultas individuais de perguntas; usa uma consulta em lote e mantém o mesmo contrato. Resposta através do frontend medida em aproximadamente 1,2 segundo. O prazo de prontidão do dev passou para três minutos porque a primeira carga de demonstração remota ultrapassou um minuto. A suíte externa usa subprocessos sem NODE_TEST_CONTEXT herdado e schemas separados em paralelo; o prazo de quinze minutos considera latência de rede. Integrações reais de SMS/pagamentos continuam pendentes; não declarar operação pronta para produção.

Resultado final: suite externa completa aprovada em aproximadamente 200 segundos, com 10 testes financeiros/domínio, oito HTTP e dois de segurança, mais o orquestrador de migrations concorrentes. Cada pool de execução confirmou elo_runtime; escrita de saldo/ledger foi recusada mesmo após conexões substituídas por erro. Schemas temporários removidos no finally e papéis dos testes anteriores removidos por nomes exatos após confirmar ausência de objetos próprios. db-verify manteve zero divergências. API e frontend verificados em 3010/4010 porque a porta 3000 foi ocupada por outro processo, preservado. A pré-verificação passou a conferir IPv4 e IPv6 separadamente.

## ADR-008 — Preço Fechado por adesão do profissional (07/10/2026)

O pedido explícito do usuário substitui a exclusão de Preço Fechado das ADR-006/007. Nesta entrega, profissionais habilitam a modalidade e publicam ofertas próprias com preço, escopo e unidade definidos, para consulta na aba pública e em /preco-fechado. Checkout, reserva e escrow continuam pendentes. A região continua Palmas, Tocantins.

Nova migration 0003_fixed_prices.sql, preservando migrations anteriores. Publicação exige opção habilitada, oferta ativa, conta ativa, telefone verificado, cadastro aprovado, serviço/categoria ativos e cobertura atual compatível. Remover um serviço do perfil retira suas ofertas da consulta pública. Não são publicados contatos ou documentos. Valores em centavos inteiros, validação zod e operações restritas ao autor da oferta. Nenhuma alteração no ledger ou nas regras de desbloqueio.

## ADR-009 — Recuperação local e encerramento do banco (07/10/2026)

A inicialização foi reproduzida sem processos escutando 3000/4000. Abrir o PGlite original com diagnóstico mostrou checkpoint inválido no WAL após interrupção. A mensagem genérica ocultava a causa. Foi feita cópia completa para .data/postgres-recovered-20261007 e o original em .data/postgres foi preservado. Um reset de WAL compatível com o layout PostgreSQL 17 foi aplicado apenas à cópia, usando código revisado da [proposta upstream #994](https://github.com/electric-sql/pglite/pull/994) (commit b01fcda, arquivo packages/pglite/src/fs/pgResetWal.ts). Essa proposta não foi incorporada à biblioteca e não foi adicionada ao código de produção do Elo.

A cópia abriu, aplicou a nova migration e reabriu após encerramento limpo. Foram verificadas contagens de registros (8 usuários, 7 pedidos, 42 leads, 7 lançamentos) e ausência de divergências entre wallets/ledger e contadores/lançamentos de desbloqueio. Essas verificações não demonstram recuperação de transações ainda ausentes dos arquivos de dados; a pasta original continua disponível para auditoria. O .env local, ignorado pelo Git, seleciona a cópia recuperada; não houve criação de banco vazio como substituição.

Prevenção: trava de processo ao lado da pasta (fora dela para não impedir initdb), fechamento do Database nos hooks Nest, encerramento por IPC no runner Windows, portas verificadas antes do banco e frontend iniciado após sinal de prontidão da API. Erros identificam porta ocupada, banco em uso, autenticação, conexão e permissões sem imprimir URLs, SQL ou credenciais. Não há reparo automático nem descarte de dados. Testes incluem persistência/reabertura, segundo processo recusado e tratamento de travas.

O runner passa ELO_API_PORT ao frontend para o rewrite; não usa PORT como destino no Next, pois o próprio Next redefine essa variável para a porta do frontend. Foi verificado HTTP 200 em /v1/health através do frontend e o ciclo completo de ofertas no Chromium. A tentativa de iniciar um segundo dev foi recusada antes de acessar o banco.

## ADR-001 — Lançamento em Palmas

Diretriz explícita do usuário em 06/10/2026: Palmas, Tocantins; expandir o catálogo pelas categorias do GetNinjas. Dez categorias e serviços representativos, sem afirmar os mesmos mais de quinhentos serviços. Marca de trabalho: Elo; verificar disponibilidade de marca/domínio antes de lançamento.

## ADR-002 — Execução local com PostgreSQL embarcado

O ambiente não possui Node, Git, Make ou Docker no PATH. Node portátil e pnpm ficam em .tools, ignorado pelo Git. PGlite permite validar SQL, triggers de ledger e fluxos localmente. Banco externo usa pg. No modo embarcado, o carregador remove citext/pg_trgm e seus índices e normaliza e-mails na borda; produção usa a migration original intacta. Fila de execução serializa transações do banco embarcado, que usa uma conexão. Concorrência em PostgreSQL externo precisa de um segundo conjunto de validações.

## ADR-003 — SQL explícito e monolito

Next.js App Router, NestJS, TypeScript e zod. SQL parametrizado em Executor/Database em vez de Kysely nesta entrega, para compartilhar SQL entre pg e PGlite sem dialect adicional. Regras críticas usam SQL e os triggers fornecidos. Auth, banco e domínio estão separados; controller REST concentra os endpoints nesta base e deverá ser dividido por módulo à medida que integrações reais forem adicionadas.

## ADR-004 — Integrações locais explícitas

Pagamentos e OTP de demonstração só com DEMO_MODE=true. Sem cobranças reais, sem QR Pix fictício e sem captura de cartão. Confirmação local usa a mesma transação idempotente de crédito. Produção falha de forma explícita enquanto gateway/SMS não estiverem configurados. Notificações persistidas são internas; os provedores externos ainda não enviam mensagens.

## ADR-005 — Privacidade e reembolso

Descrição rejeita padrões comuns de telefone, e-mail e links. Formulário pede para não inserir contatos nem endereço exato. Contatos do cliente nunca entram na listagem de leads bloqueados. Reembolso aprovado revoga acesso futuro ao contato e não reabre um dos quatro slots, pois o contato já foi exposto. Não há como apagar contatos que alguém já copiou externamente.

## ADR-006 — Escopo confirmado

Preço Fechado, app nativo, chat, S3 e provedores externos ficam para expansão. Perguntas detalhadas para Diarista/Eletricista/Encanador; os demais serviços começam com modalidade de atendimento e descrição. Formulários mais específicos podem ser adicionados por seed/migration. Avaliações só de leads efetivamente liberados e moderadas antes de alterar a nota pública.

## ADR-007 — Navegação por abas e direção visual

Solicitação do usuário em 06/10/2026: enriquecer o visual e usar abas no cabeçalho como referência de navegação. Cabeçalho em duas faixas com Orçamentos, Categorias, Como funciona e Para profissionais. Categorias abre menu pesquisável conectado ao catálogo real; serviços iniciam o fluxo existente e categorias filtram a página. No celular, abas roláveis e menu compacto. Não foi adicionada uma aba de Preço Fechado, recurso fora desta fase.

Visual próprio com verde profundo, papel claro e amarelo nos destaques, fotografia ilustrativa local na abertura, cartões com maior contraste e novas composições nas seções. Fotografia obtida de https://images.unsplash.com/photo-1621905251918-48416bd8575a, armazenada em apps/web/public/images/professional.jpg. A pessoa da imagem não é apresentada como profissional cadastrado ou depoimento real.

## ADR-013 — O Mestre Mandou e hospedagem Netlify

Em 11/10/2026, o usuário solicitou nova marca, melhoria visual e preparação de publicação. A marca pública passa a ser O Mestre Mandou, com símbolo SVG, favicon, metadados e interface próprios. Catálogo de Palmas, ofertas fixas, sessões e regras financeiras continuam conectados aos fluxos existentes. Schema `elo` e identificadores internos permanecem compatíveis com os dados históricos.

Next.js usa o adaptador oficial Netlify; `/v1/*` encaminha à Function NestJS no mesmo domínio. A API é compilada com metadados de decorators e dependências isoladas, sem iniciar servidor HTTP ou timers contínuos. Supabase permanece como PostgreSQL remoto, com TLS verificado e papel restrito. Migrations e demonstrações não são executadas no build/deploy. Segredos ficam em NETLIFY.env ignorado pelo Git e nas variáveis da plataforma.

Autenticação Netlify e publicação real ainda dependem da conta do usuário. SMS e pagamentos reais não foram implementados nesta mudança: demonstração fica desativada em produção e esses recursos bloqueiam a operação completa de novos pedidos/profissionais. Guia em PUBLICAR-NO-NETLIFY.md; evidências visuais em docs/design/VALIDACAO.md.

## ADR-014 — Cadastro completo, confirmação manual e demonstração isolada

O usuário solicitou cadastros completos e controle administrativo dos acessos rápidos. Confirmou que não configurará SMS agora e que a demonstração será separada do banco real. Cliente cadastra conta e localização sem coleta de CPF/endereço completo. Profissional escolhe serviços ativos do catálogo do PostgreSQL, informa documento/apresentação e cobertura. Usuário, perfil, associações e carteira vazia são persistidos em transação; duplicidade concorrente ou referência inválida desfaz toda a operação.

O telefone permanece pendente até confirmação manual pelo ADM, com justificativa, confirmação explícita e auditoria. Aprovação profissional continua independente e o desbloqueio preserva os requisitos financeiros existentes. O novo perfil recebe as oportunidades já existentes compatíveis ao consultar seu painel.

A demonstração local foi isolada em `elo_demo`; o schema `elo` foi preservado e continua no arquivo de publicação. Visibilidade dos atalhos é persistida em application_settings, com RLS e escrita restrita ao backend. Produção e schemas reais não podem habilitar atalhos pelo painel. Há comandos locais para promover uma conta própria de cliente a ADM e recuperar somente atalhos de demonstração. Nenhum provedor externo foi contratado ou mensagem enviada. Compra de moedas real continua pendente de gateway.

## ADR-015 — Secrets scanning do Netlify restrito a valores sensíveis

Em 11/10/2026, o deploy falhou porque o secrets scanning encontrou valores de sete variáveis importadas como secretas, como `DATABASE_RUNTIME_ROLE=elo_runtime`. Esses valores são configuração pública: nomes de papel e schema estão nas migrations já aplicadas (que não podem ser alteradas), e modos/caminhos estão em exemplos, documentação e no pacote da Function. `netlify.toml` passa a declarar `SECRETS_SCAN_OMIT_KEYS` apenas para essas chaves de configuração. DATABASE_URL, JWT_SECRET e PAYMENT_WEBHOOK_SECRET permanecem verificados; o scanning não foi desativado nem foram omitidos caminhos.
