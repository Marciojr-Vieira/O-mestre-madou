# Publicar O Mestre Mandou no Netlify

O site Next.js e a API NestJS são publicados no mesmo projeto Netlify. As rotas `/v1/*` usam uma Netlify Function e o PostgreSQL existente na Supabase. Não é necessário deixar o computador ligado nem contratar uma segunda hospedagem da API para esta configuração.

A versão atual usa **demonstração online**: `DEMO_MODE=true` e `DATABASE_SCHEMA=elo_full_demo`. Esse schema recebeu uma cópia dos dados de `elo` em 13/10/2026: 111 serviços, 14 pedidos, 84 leads, seis profissionais, uma oferta fixa e histórico de moedas. Os schemas anteriores foram preservados. Sessões de login e desafios de telefone não são transferidos; carteiras são reconstruídas pelo ledger e conferidas. Dados persistem entre deploys. SMS e pagamentos são simulados, sem cobranças. Use dados fictícios, pois os atalhos dão acesso a contas compartilhadas, inclusive ADM.

## 1. Arquivo das variáveis

Abra **NETLIFY.env** na raiz. É um arquivo privado, ignorado pelo Git, com a conexão Supabase local e um segredo JWT gerado para a publicação. Não coloque esse arquivo em `public/`, anexos públicos ou repositório. O modelo sem segredos é [NETLIFY.env.example](NETLIFY.env.example).

**APP_URL** e **WEB_ORIGIN** já estão configuradas como `https://o-mestre-mandou.netlify.app`, endereço confirmado pelo proprietário. Os valores devem ser iguais, sem caminho e sem barra final. Ao configurar domínio próprio, atualize ambos e faça um novo deploy.

No painel Netlify, abra **Project configuration → Environment variables** e use a importação de arquivo `.env`, quando disponível, ou importe pelo CLI. Inclua o escopo **Functions** para as variáveis da API e **Builds** para APP_URL. Importar todas nos dois escopos atende esta configuração. Aplique ao contexto de produção. Não compartilhe a conexão de produção com previews públicos de contribuições não confiáveis.

Para gerar novamente, preservando o modo atual e o JWT existente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 netlify-env
```

Com Node/pnpm no PATH, é possível informar a URL real:

```powershell
pnpm.cmd netlify-env --mode demo https://o-mestre-mandou.netlify.app
```

O gerador atualiza `NETLIFY.env` e guarda o perfil em `NETLIFY.demo.env`. O perfil anterior de operação real fica preservado em `NETLIFY.production.env`. Todos são privados e ignorados pelo Git; cada modo possui seu próprio segredo JWT. Não importe os dois perfis simultaneamente no mesmo contexto do Netlify.

Se o site já estiver publicado, substitua as variáveis antigas pelas de `NETLIFY.env` e publique o código atualizado. Só trocar a variável em uma versão antiga do código ainda causa o bloqueio de inicialização. Para testar nesta fase, use o endereço estável do site de demonstração; `APP_URL` e `WEB_ORIGIN` devem corresponder ao endereço aberto no navegador.

## 2. Configurar o projeto

O repositório ou pasta a publicar é **D:\Programação\O-mestre-madou**, onde estão `package.json` e `netlify.toml`. Não selecione a pasta antiga Cop-getninja.

Configurações, já registradas em `netlify.toml`:

| Campo | Valor |
| --- | --- |
| Base directory | Raiz do repositório (`.`) |
| Package directory, se o painel pedir | `apps/web` |
| Build command | `pnpm build:netlify` |
| Publish directory | `apps/web/.next` |
| Functions directory | `.netlify-api/functions` |
| Node | 22 |
| pnpm | 10.18.3 |

O adaptador oficial de Next.js é detectado pelo Netlify. Não configurar `next export` nem uma regra SPA que redirecione tudo para index.html. O build compila a API com metadados NestJS e copia migrations/certificado; não aplica migrations nem importa demonstrações na Supabase.

A API recebe um pacote separado de dependências, sem os arquivos privados locais. Dependências hoisted evitam links absolutos do Windows dentro da Function. No Windows, o adaptador Next.js pode exigir Modo de Desenvolvedor para criar symlinks; publicar pelo repositório usa o build Linux do Netlify e evita essa limitação local. Se o PowerShell bloquear os scripts pnpm, use `pnpm.cmd` nos comandos abaixo.

## 3. Publicar pelo painel ou CLI

Recomendado: conectar o repositório no Netlify, configurar variáveis e executar o deploy pelo painel. Um upload estático por arrastar uma pasta não executa a API nem adapta o Next.js.

Alternativa com Node, pnpm e autenticação Netlify:

```powershell
pnpm install --frozen-lockfile
pnpm --package=netlify-cli dlx netlify login
pnpm --package=netlify-cli dlx netlify init --filter @elo/web
pnpm --package=netlify-cli dlx netlify env:import NETLIFY.env --filter @elo/web
pnpm --package=netlify-cli dlx netlify deploy --filter @elo/web --build
```

Após conferir a URL de teste e ajustar origem/contexto das variáveis, publicar:

```powershell
pnpm --package=netlify-cli dlx netlify deploy --filter @elo/web --build --prod
```

Em um site já criado, use `pnpm --package=netlify-cli dlx netlify link --filter @elo/web` em vez de init. Não execute deploy de produção sem conferir o site vinculado.

## 4. Variáveis explicadas

| Variável | Finalidade |
| --- | --- |
| APP_URL | Links canônicos, sitemap e identidade da origem pública |
| WEB_ORIGIN | Origem autorizada da sessão e CORS; precisa coincidir com o site |
| DEMO_MODE=true | Ativa os recursos de demonstração, OTP e pagamentos simulados |
| DATABASE_MODE=postgres | Impede uso de banco embarcado efêmero |
| DATABASE_URL | URI PostgreSQL do Session pooler, com senha codificada na URL |
| DATABASE_SCHEMA=elo_full_demo | Cópia completa da operação para demonstração, separada de elo |
| DATABASE_SSL=verify-full | Valida o certificado TLS |
| DATABASE_CA_FILE | Caminho do certificado incluído na Function |
| DATABASE_ASSETS_DIR | Caminho dos arquivos de versão incluídos no pacote |
| DATABASE_POOL_MAX=2 | Limite por instância da Function, não limite global |
| DATABASE_MIGRATE=false | Migrations são tarefa administrativa separada |
| DATABASE_RUNTIME_ROLE=elo_runtime | Papel restrito em cada conexão |
| JWT_SECRET | Segredo estável da sessão; não reutilizar valor de exemplo |
| AWS_LAMBDA_JS_RUNTIME | Runtime da Function alinhado ao Node 22 |

Na importação, marque como segredo somente DATABASE_URL e JWT_SECRET. As demais variáveis são configuração pública: o nome do papel e do schema aparecem nas migrations e o build as ignora no secrets scanning via `SECRETS_SCAN_OMIT_KEYS` em netlify.toml. Não adicione chaves sensíveis a essa lista.

No pacote final da Function, `db/` e `certs/` ficam na raiz. Por isso, use `DATABASE_ASSETS_DIR=.` e `DATABASE_CA_FILE=certs/supabase-ca.crt` exatamente como no arquivo gerado. Esses caminhos são diferentes dos diretórios intermediários de compilação.

Não são necessárias chaves `NEXT_PUBLIC_SUPABASE_*`: o navegador usa `/v1`, e a API conecta ao PostgreSQL. Não importar PORT, DATA_DIR, caminhos `.tools`, credenciais Docker, REDIS_URL ou segredos de gateways ainda não implementados. NODE_ENV é configurado pela plataforma.

O login administrativo de PostgreSQL com SET ROLE é a configuração existente. Para a operação pública, recomenda-se emitir login dedicado com privilégio mínimo e atualizar DATABASE_URL. O total de conexões cresce com a quantidade de instâncias: acompanhar o pooler e os limites do plano.

## 5. Verificar após a publicação

1. Página inicial, busca, menu e Preço Fechado sem erros.
2. `/v1/health` retorna JSON, com demo true.
3. `/v1/catalog` retorna os serviços de Palmas.
4. Cadastro/login e atualização da sessão funcionam na origem HTTPS configurada.
5. `/sitemap.xml` e `/robots.txt` apontam ao domínio real.
6. Painel profissional e ações privadas recusam acesso anônimo.
7. Logs das Functions não mostram URI, senha ou dados pessoais.
8. Em **Entrar**, aparecem os atalhos Cliente, Profissional e Admin. No ADM, abra **Cadastros e demonstração → Acessos rápidos de demonstração** para desativar ou ativar novamente. O controle é salvo no banco e sobrevive a novos deploys. Desativar atalhos não encerra sessões abertas nem desativa as simulações.

Se os atalhos estiverem ocultos e não houver outra sessão de ADM aberta, recupere pelo terminal com `pnpm.cmd demo-access on`, usando o `.env` local que aponta para `elo_full_demo`. O site local e a demonstração online compartilham esse schema: mudanças em cadastros, pedidos e configurações aparecem nos dois. O acesso pessoal do proprietário usa e-mail/senha no login normal; credenciais foram entregues somente no arquivo privado `.data/ACESSO-ADM-elo_full_demo.txt`, ignorado pelo Git.

Se `/v1/*` responder 503, conferir variáveis no escopo Functions, origem, certificado, credenciais, migrations e conectividade do pooler. Se responder HTML, conferir redirects e ativação do adaptador Next.js. A rede da Supabase deve permitir conexões da plataforma, conforme a configuração do projeto.

Se todas as rotas `/v1/*`, inclusive health, responderem **502** com `Runtime.UserCodeSyntaxError` e `Unexpected token 'export'`, a Function falhou antes de iniciar a API. O empacotamento anterior criava uma entrada ESM em `api.js`, carregada como CommonJS pelo Lambda. O build corrigido gera `api.cjs`, compatível com a API compilada. Publique o código atualizado com **Clear cache and deploy site** no painel Netlify, usando `pnpm build:netlify`; alterar apenas as variáveis não corrige esse erro de sintaxe. Depois, confira `/v1/health`, `/v1/catalog` e `/v1/auth/options`; refresh anônimo pode retornar 401 normalmente.

## 6. Limites da entrega

A preparação de hospedagem não contrata SMS ou gateway financeiro. Conforme a decisão do usuário, o telefone em produção é confirmado manualmente pelo ADM, com registro de auditoria; os cadastros ficam pendentes até essa confirmação. O fluxo está descrito em [CADASTROS.md](docs/CADASTROS.md), inclusive criação do primeiro administrador real. Compra real de moedas ainda depende de gateway configurado; nenhuma cobrança real foi habilitada. Preço Fechado continua sendo consulta de ofertas, sem checkout de serviço.

A execução otimizada do Netlify (`NODE_ENV=production`) aceita demonstração desde que o schema termine em `_demo`. A API continua recusando `DEMO_MODE=true` em `elo` ou `public`. Quando for preparar a operação real, gere `pnpm.cmd netlify-env --mode production https://SEU-SITE-REAL.netlify.app`, confira `DEMO_MODE=false` e `DATABASE_SCHEMA=elo`, importe o perfil e publique novamente. Os registros da demonstração não são transferidos automaticamente.

Expiração de pedidos é conferida na consulta/desbloqueio; tarefas contínuas e notificações externas não podem depender de setInterval em Functions. O limitador atual por processo deve evoluir para controle distribuído antes de operação ampla.

Referências oficiais: [Next.js no Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Express em Functions](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/), [monorepos](https://docs.netlify.com/build/configure-builds/monorepos/).
