# Estado atual

Base funcional do Elo com PostgreSQL na Supabase: catálogo de dez categorias e mais de cem serviços, atendimento inicial em Palmas, front responsivo e API NestJS. PGlite permanece como opção offline e backup. As referências originais estão preservadas em files/.

## Entregue

- [x] Estudo completo dos pagamentos em docs/PAYMENTS.md: moedas, métodos, provedores, confirmação, estornos, contestações, conciliação e futura contratação de Preço Fechado. Proposta documental; gateway real ainda pendente.

- [x] Guia RODAR-NO-VSCODE.md com comandos PowerShell, execução em dois terminais, verificação, Supabase e diagnóstico; tarefas do VS Code adicionadas.
- [x] .env.example aponta por padrão para o projeto Supabase confirmado, com placeholder de senha, TLS e papel restrito.
- [x] Importação local autorizada em 08/10/2026: sete pedidos, 42 leads, 12 respostas, 43 notificações, duas sessões e um lançamento de débito. Oito contas correspondentes e seis créditos existentes reutilizados; nenhum saldo alterado diretamente.
- [x] Importação em transação, marcador de auditoria com hash e remapeamento de IDs; duas execuções concorrentes resultaram em uma importação e uma repetição sem alterações. Backup local preservado.

- [x] MCP Supabase autenticado no projeto confirmado `catfliwcaezqtgakaxwa`; skill oficial de boas práticas PostgreSQL instalada.
- [x] Migrations e catálogo aplicados pelo MCP no schema privado elo: 28 tabelas, dez categorias, 111 serviços e Palmas. Catálogo e RLS conferidos remotamente.
- [x] Papel restrito de API, ledger protegido, TLS verificado, pool limitado, migrations com advisory lock e comandos db-migrate/db-verify/test-postgres.
- [x] Permissões de função administrativa preexistente corrigidas por nova migration; advisor de segurança da Supabase sem alertas.
- [x] Lint, TypeScript, 26 testes locais e build aprovados após configuração Supabase; rotação de sessão, exclusão de conta, TLS e bigint incluídos.
- [x] API conectada ao Session pooler do projeto confirmado, com TLS verificado e papel elo_runtime configurado/verificado em cada conexão física.
- [x] Catálogo sem consultas individuais por serviço; HTTP 200 na página inicial, Preço Fechado e health, 111 serviços e resposta de catálogo em aproximadamente 1,2 segundo.
- [x] Suíte externa completa aprovada: 20 testes no PostgreSQL real, mais orquestrador de migrations concorrentes, com papel restrito, reconexão após erros, RLS e concorrência financeira. Schemas/papéis temporários removidos.

- [x] Preço Fechado habilitável pelo profissional, criação/edição/pausa/exclusão de ofertas e consulta pública por busca/categoria em /preco-fechado.
- [x] Nova migration e validação de autoria, valor em centavos, aprovação e cobertura para ofertas públicas.
- [x] Falha local de WAL diagnosticada; cópia recuperada e original preservado. Inicialização com proteção de porta/banco e fechamento do PGlite.
- [x] 20 testes automatizados aprovados, incluindo ofertas públicas e persistência/reabertura; build com a nova rota aprovado.
- [x] Chromium: ativação, criação com centavos exatos, consulta pública, exclusão e desativação. Layout em 1440, 1024, 768 e 390 px sem overflow ou erros de JavaScript. Capturas em docs/previews/elo-fixed-prices-*.png.

- [x] Marca/interface própria, busca e categorias, conteúdo em pt-BR.
- [x] Cadastro/login, refresh HttpOnly rotativo, OTP de teste e consentimento.
- [x] Cadastro profissional, serviços/cidade e aprovação manual.
- [x] Formulários, publicação/cancelamento/expiração e matching.
- [x] Leads privados, quatro slots, débito transacional e ledger imutável.
- [x] Pagamento simulado, confirmação idempotente e extrato.
- [x] Painéis cliente/profissional/admin, avaliação moderada, reembolso.
- [x] Notificações internas, anonimização e documentação de execução.
- [x] 16 testes de regras críticas e autorização HTTP aprovados; lint e TypeScript sem erros.
- [x] Build Next.js aprovado: 111 páginas de serviço e 116 páginas/rotas estáticas no total.
- [x] Integração local web/API verificada por HTTP, catálogo e sitemap conferidos.
- [x] Revisão visual: cabeçalho com quatro abas, menu pesquisável, fotografia ilustrativa local, novas composições e adaptação para celular.
- [x] Navegador Chromium: desktop 1440 px e celular 390 px; busca, início de pedido, filtro por categoria, navegação profissional, menu móvel e Escape verificados sem erros de JavaScript ou overflow horizontal.

## Próxima tarefa

Configurar gateway Pix/cartão real e SMS, com assinatura de webhooks, reconciliação e testes do provedor. Preparar deploy com login PostgreSQL dedicado, backups, política de privacidade definitiva e onboarding de profissionais reais em Palmas. Transações e concorrência no PostgreSQL externo já foram validadas.

## Expansão

- [ ] Notificações externas por filas, upload S3 com URLs assinadas e anexos protegidos.
- [ ] Formulários específicos por cada serviço e cadastro/edição avançado do catálogo.
- [ ] Verificação documental por provedor; critérios das profissões regulamentadas.
- [x] 111 páginas estáticas por serviço/cidade, sitemap, metadados e structured data Service.
- [ ] Domínio real e regeneração do índice SEO ao expandir o catálogo (make sync-catalog).
- [ ] Separação de controllers/services por módulo e adoção de Kysely.
- [ ] Recuperação de senha, controles de sessão e rate limit distribuído.
- [ ] Mais cidades do Tocantins; apps nativos; checkout/reservas e escrow para ofertas de Preço Fechado.

## Log de sessões

- 13/10/2026 — Correção publicada em https://o-mestre-mandou.netlify.app pelo GitHub vinculado, commit 3eddef4, deploy 6ace6dc1c2f868a45e9766a9. Supabase elo_full_demo recebeu 111 serviços, 14 pedidos, 84 leads, uma oferta fixa e ledger de elo; bancos anteriores preservados. ADM pessoal com senha criado, credenciais somente em arquivo privado. Lint, TypeScript e 40 testes aprovados. Validação HTTPS pública passou em health/catalog/options, login ADM, cookies Secure, refresh, atalhos, alternância pelo ADM, pedido/matching, compra simulada e desbloqueio idempotentes. Validação acrescentou um pedido, seis leads e um pagamento simulado ao novo schema. Chromium desktop/celular sem erros 5xx ou JavaScript. Documentação em DEMONSTRACAO-DADOS.md.

- 13/10/2026 — Erros 502 do Netlify diagnosticados na URL publicada: `Runtime.UserCodeSyntaxError: Unexpected token 'export'`. ZIP anterior tinha entrada api.js com export ESM; preparador corrigido para CommonJS api.cjs e remoção do wrapper antigo. Lint, TypeScript, 39 testes, build web (118 páginas) e build da API aprovados. ZIP gerado pelo empacotador oficial, com Node 22 e bundler none, extraído e executado pela entrada api.js: health/catalog/options 200, 111 serviços e refresh anônimo 401 contra Supabase, com seed de demonstração desativado apenas no processo de verificação. Guia atualizado e ADR-017 registrada. Correção ainda não publicada: CLI Netlify sem autenticação; necessário novo deploy do código corrigido.

- 11/10/2026 — Deploy Netlify bloqueado pelo secrets scanning corrigido: valores de configuração pública (papel elo_runtime, schema, modos, caminhos) estavam marcados como segredo e aparecem em migrations e exemplos. Adicionado SECRETS_SCAN_OMIT_KEYS somente para essas chaves; DATABASE_URL e JWT_SECRET continuam protegidos. Nenhum segredo real encontrado nos arquivos versionados. ADR-015.

- 11/10/2026 — Preparação do envio ao GitHub para integração com Netlify: conta conectada brn-mascarenhas identificada, arquivos privados excluídos e .gitignore ampliado para variantes de .env. Criação do repositório o-mestre-mandou pendente; o conector disponível não oferece essa operação.

- 11/10/2026 — URL da demonstração confirmada: https://o-mestre-mandou.netlify.app. Variáveis APP_URL/WEB_ORIGIN dos perfis de demonstração, exemplo público e guia atualizados; schema elo_demo e origem local conferidos. Arquivos prontos para importação no painel; sem publicação remota nesta etapa.

- 11/10/2026 — Demonstração hospedada no Netlify habilitada no código, com elo_demo separado de elo, perfis privados de variáveis e JWT próprio por ambiente. Controle dos acessos rápidos no ADM preservado; geração de NETLIFY.env e guia de publicação atualizados. Lint, TypeScript e 38 testes aprovados; build Netlify offline gerou 118 páginas e duas Functions. API extraída do ZIP final testada com Supabase: três logins rápidos, cookies HTTPS, refresh e alternância ADM aprovados; perfil real manteve atalhos bloqueados. Publicação remota não executada: CLI sem autenticação.

- 11/10/2026 — Cadastros de cliente/profissional em etapas, seleção pesquisável do catálogo, persistência transacional e painel de conta implementados. Confirmação manual de telefone no ADM conforme decisão de não configurar SMS. Controle persistente dos acessos rápidos em demonstração separada, protegido em produção; schema local alterado para elo_demo sem remover elo. Migration 0006 aplicada na Supabase; catálogo, RLS, saldos e slots conferidos. Testes novos de cadastros, concorrência, rollback, autorização e auditoria, além de QA no Chromium desktop/celular. Documentação em CADASTROS.md.

- 11/10/2026 — Marca pública alterada para O Mestre Mandou. Nova identidade SVG, favicon, fotografias ilustrativas, abertura, categorias, abas e composição responsiva; catálogo e fluxos existentes preservados. API NestJS adaptada a Netlify Function com dependências isoladas e Supabase remoto. Guia PUBLICAR-NO-NETLIFY.md e arquivo privado NETLIFY.env criados. Lint, TypeScript, 29 testes e navegação em cinco larguras conferidos. Publicação real depende da autenticação Netlify; SMS e pagamentos reais permanecem pendentes para operação completa. Evidências em docs/design/VALIDACAO.md.

- 08/10/2026 — Estudo de pagamentos solicitado pelo usuário, com pesquisa em documentação oficial. Proposta separa moedas e serviços, recomenda integração inicial Pix/cartão e inclui devoluções/conciliação desde a primeira cobrança. Nenhuma regra financeira, migration ou cobrança alterada; decisões comerciais e homologação real permanecem pendentes. ADR-012.

- 08/10/2026 — Guia de execução manual e tarefas do VS Code criados. Configuração Supabase conferida; instância existente em 3000/4000 preservada e verificada. Usuário autorizou também os registros locais: export de uma cópia, importação transacional e conciliação de contas/créditos. Marcador de auditoria protege repetição concorrente; ledger e slots validados antes do commit. Migrations anteriores preservadas.

- 07/10/2026 — Conexão pelo Session pooler correto concluída com TLS verificado. Corrigido papel de execução ignorado pelo pooler via onConnect assíncrono, inclusive após erros/reconexões. Catálogo agrupado em uma consulta de perguntas; resposta medida em 0,8–1,2 segundo. Suíte externa completa aprovada (20 testes e orquestrador de migrations concorrentes), db-verify sem divergências e HTTP 200 em health/inicial/Preço Fechado. Verificação em portas alternativas preservou outro processo na 3000. Registros locais originais preservados; SMS/gateway reais continuam pendentes.

- 07/10/2026 — Supabase configurada no projeto explicitamente confirmado. Schema vazio de aplicação recebeu migrations e seeds; segurança e catálogo verificados via MCP. Conexão direta IPv6 indisponível; validação da API e testes nativos externos aguardam Session pooler. Dados locais preservados. Decisão e limites na ADR-010.

- 07/10/2026 — Preço Fechado solicitado explicitamente: adesão do profissional e catálogo público de valores fixos. Corrigida a inicialização local através de recuperação em cópia, com diagnóstico de WAL inválido; banco original preservado e limites registrados na ADR-009. Adicionadas trava de banco, mensagens específicas e encerramento coordenado. PostgreSQL externo e integrações reais continuam pendentes.
  Verificação final: lint, TypeScript, 20 testes e build aprovados. Fluxo completo de ofertas conferido em Chromium desktop/celular; ofertas de teste removidas. Rewrite da API corrigido e segunda instância recusada. Servidor de verificação encerrado por IPC e banco reaberto sem divergências no ledger.

- 06/10/2026 — Referências analisadas, funcionamento oficial pesquisado, região corrigida para Palmas por solicitação do usuário. Entrega local com dez categorias e 111 serviços. Verificação final: lint, typecheck, 16 testes e build aprovados. Página inicial, página Diarista/Palmas, API e sitemap retornaram HTTP 200. Baseline SQL preservada por comparação de hash. Servidor de verificação encerrado; iniciar com make.ps1 dev. Sem validação visual em navegador ou execução de PostgreSQL externo neste ambiente.
- 06/10/2026 — Revisão visual solicitada pelo usuário: abas no cabeçalho inspiradas na navegação do GetNinjas, menu de categorias conectado ao catálogo, hero fotográfico, paleta e cartões renovados. make.ps1 check aprovado (16 testes), build aprovado e interação visual verificada em Chromium desktop/celular. Capturas em docs/previews/. Servidor já iniciado pelo usuário em localhost:3000 preservado; nenhuma alteração nas regras financeiras ou migrations.
