# Rodar o O Mestre Mandou pelo VS Code no Windows

Abra a pasta **D:\Programação\O-mestre-madou** no VS Code e escolha **Terminal → Novo Terminal → PowerShell**. Os mesmos comandos funcionam no terminal PowerShell do Visual Studio.

## Iniciar o site

```powershell
Set-Location -LiteralPath 'D:\Programação\O-mestre-madou'
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 dev
```

Abra **http://localhost:3000**. Preço Fechado: **http://localhost:3000/preco-fechado**. A API fica em **http://localhost:4000/v1/health**. Deixe o terminal aberto e encerre com **Ctrl+C**. `dev` inicia a API, espera sua prontidão e inicia o frontend. Use uma única instância nas mesmas portas; se o site já estiver aberto, não execute uma segunda cópia.

## Rodar na mão em dois terminais

Não execute `dev` ao mesmo tempo que os comandos abaixo.

**Terminal 1 — API NestJS:**

```powershell
Set-Location -LiteralPath 'D:\Programação\O-mestre-madou'
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 api
```

**Terminal 2 — site Next.js:**

```powershell
Set-Location -LiteralPath 'D:\Programação\O-mestre-madou'
$env:ELO_API_PORT='4000'
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 web
```

Espere a API informar que está pronta antes de abrir o site. Os exemplos usam as portas atuais 3000/4000. Encerre os dois terminais com Ctrl+C.

## Instalar dependências

Na primeira execução ou depois de atualizar as dependências:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 setup
```

O script usa Node e pnpm portáteis já existentes em `.tools`. Se essa pasta não existir em outra máquina, instale Node 24 e pnpm 10. `setup` preserva o `.env` existente; não substitua suas credenciais pelo exemplo.

## Banco: Supabase configurada

O aplicativo usa PostgreSQL externo no projeto **catfliwcaezqtgakaxwa**, pelo Session pooler `aws-1-ca-central-1.pooler.supabase.com:5432`. A demonstração local usa **elo_demo**; o site de produção usa **elo**, com os dados históricos preservados. API, carteira, pedidos, catálogo, sessões e ofertas usam o schema do ambiente escolhido. Não é necessário iniciar Docker nem um PostgreSQL local.

O `.env` local já contém a conexão validada. As opções são:

```dotenv
DATABASE_MODE=postgres
DATABASE_SCHEMA=elo_demo
DATABASE_SSL=verify-full
DATABASE_CA_FILE=.tools/supabase-ca.crt
DATABASE_POOL_MAX=6
DATABASE_MIGRATE=false
DATABASE_RUNTIME_ROLE=elo_runtime
PORT=4000
WEB_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
DEMO_MODE=true
```

`DATABASE_URL` contém a URI PostgreSQL com senha e permanece apenas no `.env`, ignorado pelo Git. Não cole esse arquivo em logs, documentos ou chats. Em outra máquina, copie a URI em **Supabase → Connect → Session pooler**, codifique caracteres especiais da senha e baixe o certificado em **Database Settings → SSL Configuration**, salvando-o em `.tools/supabase-ca.crt`. Mantenha a verificação TLS ativada.

O MCP permite administrar a Supabase pelo Codex; o aplicativo conecta diretamente pelo PostgreSQL e não depende de uma sessão do MCP para funcionar. Chaves HTTP da Supabase não substituem `DATABASE_URL`.

## Migrações e verificação

Após adicionar uma migration, execute primeiro:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 db-migrate
```

Esse comando usa a credencial administrativa para aplicar apenas arquivos pendentes. A API usa o papel restrito `elo_runtime`, configurado e verificado em cada conexão. Nunca altere saldos manualmente nem edite migrations já aplicadas.

Para conferir o banco e os endpoints:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 db-verify
Invoke-RestMethod 'http://localhost:4000/v1/health'
Invoke-RestMethod 'http://localhost:3000/v1/health'
```

`db-verify` confere dez categorias, 111 serviços, Palmas, formulários, preços, RLS e consistência de carteira e desbloqueios. Os comandos HTTP exigem o aplicativo iniciado.

Para conferir código e build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 check
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 build
```

Para validar transações e concorrência no PostgreSQL real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 test-postgres
```

Essa suíte usa schemas temporários próprios e pode levar alguns minutos; não limpa as tabelas do aplicativo.

## Dados do banco local antigo

A importação autorizada usa uma cópia de `.data/postgres-recovered-20261007`, preservando o original e a cópia recuperada. O export fica em `.data/local-import-20261008.json`, ignorado pelo Git, e contém dados privados; não compartilhe esse arquivo.

O importador concilia contas pelo e-mail, remapeia referências, preserva os dados atuais da Supabase e reutiliza os créditos de demonstração já lançados. Saldos são recalculados somente pelo trigger do ledger. Histórico de pedidos, leads, respostas, notificações e sessões é importado em uma transação. Um marcador de auditoria impede duplicar a mesma origem, inclusive com execuções concorrentes. Conteúdo diferente de uma origem já importada é recusado para revisão.

Para verificar uma reexecução da mesma cópia, sem duplicar os registros:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 import-local
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 db-verify
```

Essa importação histórica já foi aplicada em `elo`. Antes de reexecutar os comandos acima, selecione explicitamente o destino com `$env:DATABASE_SCHEMA='elo'` e remova a sobrescrita ao terminar com `Remove-Item Env:DATABASE_SCHEMA`. Não importe os registros reais em `elo_demo`.

O importador é específico para o snapshot desta entrega e recusa tabelas adicionais com registros sem mapeamento; não o use para outra base sem revisão. Catálogo, regras atuais de preço e perfis existentes da Supabase são preservados.

## Atalhos no VS Code

Use **Terminal → Executar Tarefa** e selecione uma tarefa **O Mestre Mandou**. A tarefa de iniciar tudo executa o mesmo `make.ps1 dev`. As tarefas de API e site servem para os dois terminais separados.

## Se não iniciar

| Mensagem | Ação |
|---|---|
| Porta ocupada | Volte ao terminal da instância anterior e use Ctrl+C; não encerre processos desconhecidos. |
| Autenticação PostgreSQL recusada | Confira a senha da URI no `.env` e o projeto do usuário do pooler. |
| Certificado não validado | Confira `DATABASE_CA_FILE` e use o certificado oficial. |
| Migrations pendentes | Execute `db-migrate` antes da API. |
| API pronta, mas site sem dados | No terminal do site, confira `ELO_API_PORT=4000` e a API em execução. |

Para conferir quem ocupa as portas, sem encerrar processos:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,4000 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

**Limites atuais:** DEMO_MODE usa OTP e pagamentos simulados; não envia SMS nem cobra valores reais. Sem SMS, a confirmação de telefone em produção é manual pelo ADM. Compra real de moedas ainda precisa de gateway. Veja [CADASTROS.md](docs/CADASTROS.md) para os cadastros, aprovação e acessos rápidos.
