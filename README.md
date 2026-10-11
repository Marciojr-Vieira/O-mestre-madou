# O Mestre Mandou

Marketplace de serviços com identidade própria, construído a partir das referências em `files/` e do funcionamento público do GetNinjas. Lançamento em **Palmas, Tocantins**, conforme orientação do usuário. Dez categorias e mais de cem serviços; catálogo expansível pela administração.

Guia de publicação e variáveis: [PUBLICAR-NO-NETLIFY.md](PUBLICAR-NO-NETLIFY.md). Arquivo privado para importar no painel: NETLIFY.env (não versionado).

Cadastros, confirmação manual de contato, criação de ADM e controle de demonstração: [CADASTROS.md](docs/CADASTROS.md). Demonstração local usa o schema `elo_demo`; a publicação usa `elo`, com acessos rápidos bloqueados.

## Rodar no Windows

Guia de comandos para VS Code, dois terminais, Supabase e diagnóstico: [RODAR-NO-VSCODE.md](RODAR-NO-VSCODE.md).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 setup
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 dev
```

Abra **http://localhost:3000**. A API responde em http://localhost:4000/v1/health. O script usa Node/pnpm portáteis de `.tools/`, quando disponíveis; em outras máquinas, instale Node 24 LTS e pnpm 10. Linux/macOS: `make setup`, `make dev`.

O aplicativo está configurado para o PostgreSQL da Supabase, sem necessidade de Docker local. O `.env.example` também usa essa configuração, com senha de exemplo a substituir somente no `.env`. PGlite continua disponível como modo offline explícito (`DATABASE_MODE=embedded`); `DATA_DIR` não é aberto quando o modo é postgres. Selecione **Entrar → Cliente / Profissional / Admin** na área de demonstração para testar os três papéis. Registros fictícios usam endereços `.invalid` e telefones de teste. Novas contas podem ser criadas normalmente. Senhas fictícias são aleatórias; o acesso de demonstração existe apenas com `DEMO_MODE=true`.

## Preço Fechado

No painel profissional, abra **Meus preços fixos**, habilite **Preço Fechado** e crie ofertas para os serviços do seu perfil em Palmas. Informe título, escopo, valor em reais e unidade (serviço, visita, hora ou diária). É possível editar, pausar ou excluir cada oferta; desabilitar a opção retira todas as suas ofertas da consulta pública.

A aba **Preço Fechado**, também acessível em **http://localhost:3000/preco-fechado**, reúne os valores com filtros de busca e categoria. Só aparecem ofertas ativas de profissionais com cadastro aprovado, telefone verificado, conta ativa e cobertura compatível. O catálogo é para visualização; não cria reservas ou cobranças do serviço. Valores são armazenados em centavos inteiros e a API valida escopo, autoria e cobertura.

## Supabase e PostgreSQL externo

Estudo de organização dos pagamentos: [docs/PAYMENTS.md](docs/PAYMENTS.md). A proposta cobre compra de moedas, Pix/cartão, estornos, contestações, conciliação e futura contratação de Preço Fechado; cobranças reais ainda dependem de integração e homologação.

O MCP está configurado e autenticado para `catfliwcaezqtgakaxwa`. O banco recebeu as migrations e o catálogo no schema privado **elo**: 28 tabelas, dez categorias, 111 serviços e Palmas. A autenticação do aplicativo continua na API NestJS; chaves HTTP da Supabase não substituem `DATABASE_URL`.

Em **Supabase → Connect → Session pooler**, copie a URI PostgreSQL para o `.env` local, com a senha codificada como componente de URL. A conexão direta desse projeto resolve apenas para IPv6 e falhou na rede usada nesta sessão. Configure:

```dotenv
DATABASE_MODE=postgres
DATABASE_SCHEMA=elo
DATABASE_SSL=verify-full
DATABASE_POOL_MAX=6
DATABASE_MIGRATE=false
DATABASE_RUNTIME_ROLE=elo_runtime
```

TLS verifica o certificado. Se a conexão exigir a autoridade certificadora da Supabase, baixe o certificado oficial no painel e informe seu caminho em `DATABASE_CA_FILE`; não desative a verificação. Mantenha credenciais somente no `.env`, ignorado pelo Git.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 db-migrate
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 db-verify
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 test-postgres
```

`db-migrate` aplica somente arquivos pendentes, com trava de migração e transações, usando uma credencial administrativa. A API usa o papel restrito `elo_runtime`, sem escrita direta de saldo nem alteração/exclusão do ledger. `db-verify` confere catálogo, formulários, preços, RLS e consistência financeira. `test-postgres` executa migrations concorrentes e os testes financeiros/HTTP em schemas temporários próprios; remove somente esses schemas ao terminar. Linux/macOS: os mesmos alvos no Makefile.

**Estado atual:** API conectada ao Session pooler do projeto confirmado, com TLS verificado. Schema e catálogo conferidos pelo MCP e pelo comando db-verify; revisão de segurança da Supabase sem alertas. O papel elo_runtime é configurado e verificado em cada nova conexão, pois o pooler ignorou esse parâmetro de startup. O catálogo carrega perguntas em lote. Em 08/10/2026 os registros locais foram importados por autorização do usuário: sete pedidos, 42 leads, 12 respostas, 43 notificações, duas sessões e um débito histórico. Contas correspondentes e seis créditos já existentes foram reutilizados. A importação concorrente não duplicou registros; os arquivos locais foram preservados. DEMO_MODE continua explícito.

## Diagnóstico de inicialização

O comando `dev` verifica as portas antes de abrir o banco e inicia o frontend somente quando a API estiver pronta. Use uma instância por banco embarcado e encerre com **Ctrl+C**, permitindo o fechamento do PGlite. Uma trava ao lado de `DATA_DIR` impede abertura simultânea por APIs do Elo; travas de processos encerrados são recuperadas, mas arquivos de trava inválidos exigem inspeção. Não abra essa pasta diretamente com outras ferramentas enquanto a API estiver ativa.

Em 07/10/2026 foi reproduzida a falha `Aborted()` em `.data/postgres`: o diagnóstico do PGlite mostrou `could not locate a valid checkpoint record`, após interrupção. Foi criada uma cópia em `.data/postgres-recovered-20261007`, recuperada e selecionada no `.env` local. O banco original permanece preservado. A cópia reabriu e foram verificados 8 usuários, 7 pedidos, 42 leads e 7 lançamentos, sem divergências entre ledger/saldos ou contadores de desbloqueio. A recuperação de WAL não garante recuperar transações que não chegaram aos arquivos de dados; mantenha o original para auditoria. Procedimento e fonte registrados em [docs/DECISIONS.md](docs/DECISIONS.md).

Se a falha reaparecer, pare os processos, preserve uma cópia completa de `DATA_DIR` e investigue os logs de inicialização do PGlite em uma cópia isolada. Não apague o banco, não faça reset automático de WAL e não inicialize um banco vazio sobre a pasta existente. Erros de porta, banco em uso, permissão, autenticação e conexão agora têm mensagens específicas sem expor credenciais. PostgreSQL externo deve estar iniciado e `DATABASE_URL` configurada corretamente.

## Fluxos implementados

- Catálogo pesquisável por dez categorias, com formulários por serviço e foco em Palmas.
- Cadastro/login com Argon2id, token de acesso curto e refresh rotativo em cookie HttpOnly; verificação de telefone com código de teste local.
- Pedido gratuito, respostas validadas, consentimento, painel do cliente, cancelamento e expiração em sete dias.
- Matching por serviço/cidade, até vinte ofertas por pedido e notificações na conta.
- Cadastro profissional, seleção de serviços, cidade e aprovação administrativa.
- Leads sem contato na listagem; desbloqueio autorizado e transacional, limite de quatro profissionais, preço congelado e saldo calculado pelo ledger.
- Pacotes pré-pagos, Pix/cartão **simulados**, confirmação idempotente e extrato imutável.
- Negociação externa por WhatsApp/e-mail; resultado do contato, avaliações moderadas e reembolsos analisados pela administração.
- Admin: métricas, cadastro profissional, moderação, reembolsos, ativação de serviços e regras de preço.
- Notificações internas, termos provisórios e anonimização/exclusão de conta preservando registros financeiros.
- Interface responsiva com marca própria, formulários acessíveis, 111 páginas estáticas por serviço/cidade, metadados, sitemap e structured data Service.

O cabeçalho tem abas de Orçamentos, Categorias, Como funciona e Para profissionais. O menu de categorias permite pesquisar serviços, iniciar pedidos e filtrar a página; no celular, há abas roláveis e menu compacto. A abertura usa fotografia ilustrativa armazenada localmente, acompanhada de cartões, cores e composição próprios do Elo.

## Verificação

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 check
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 build
```

Validação concluída: lint, TypeScript, **26 testes locais aprovados** e build Next.js. A suíte externa também passou no PostgreSQL real da Supabase: **20 testes** de domínio, HTTP e segurança, mais o teste orquestrador que verifica migrations concorrentes e limpa seus schemas temporários. Inclui concorrência de desbloqueios e débitos, quatro slots, idempotência de pagamento/reembolso, rollback, RLS, papel restrito preservado após erros/reconexão, sessão, exclusão de conta e Preço Fechado. Configuração TLS e bigint seguro são verificados localmente. Health, página inicial e Preço Fechado retornaram HTTP 200 com a Supabase; catálogo completo respondeu em aproximadamente 0,8–1,2 segundo.

A revisão visual anterior foi conferida em Chromium desktop (1440 px) e celular (390 px), incluindo abas, busca, pedidos e menu móvel, sem erros de JavaScript ou overflow horizontal. Capturas em [docs/previews](docs/previews/elo-desktop.png). A porta 3000 ocupada por outro processo foi preservada; a verificação final usou 3010/4010 temporariamente, sem alterar as portas do `.env`.

## Produção e limites

O projeto é uma **base funcional local**, não uma operação pública pronta. Pix/cartão não cobram valores reais; SMS, validação externa de documentos, envio de e-mails/push/WhatsApp e upload S3 ainda requerem provedores. Preço Fechado disponibiliza um catálogo de ofertas; checkout de serviços, escrow, chat interno e app nativo ainda não foram implementados. A aprovação administrativa de CPF/CNPJ é manual; o sistema não consulta bases documentais externas.

O worker BullMQ está preparado para matching/expiração no PostgreSQL externo, mas o fluxo atual faz matching síncrono e expiração no processo da API. As notificações são armazenadas no banco e exibidas na interface, sem envio externo.

Para preparar produção: `DATABASE_MODE=postgres`, `DATABASE_URL`, `DEMO_MODE=false`, `NODE_ENV=production`, `JWT_SECRET` aleatório com pelo menos 32 caracteres, `WEB_ORIGIN` e `APP_URL` definitivos. A configuração bloqueia produção com contas demo ou banco embarcado. Execute `db-migrate` no deploy com credencial administrativa e inicie a API com `DATABASE_MIGRATE=false` e login de banco restrito. Use TLS/reverse proxy, backups e gateway autenticado. `.env` é ignorado pelo Git.

Leia [estado e próximos passos](docs/ROADMAP.md), [decisões](docs/DECISIONS.md) e [pesquisa](docs/RESEARCH.md). Os originais em `files/` foram preservados como referência, inclusive suas instruções para agentes, distinguindo-os do pedido direto do usuário.
