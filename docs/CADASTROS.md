# Cadastros, aprovação e demonstração

## Cliente

Na tela de login, escolha **Sou cliente → Ainda não tenho conta**. Informe nome, e-mail, celular, senha e confirmação. Escolha a cidade do catálogo e, opcionalmente, o bairro. Revise os dados e aceite os termos antes de criar a conta. Não é necessário fornecer CPF nem endereço completo para solicitar serviços.

O painel **Minha conta** permite conferir contatos, atualizar nome/localização e acompanhar a confirmação do telefone. Cadastro e consentimento são persistidos. Sem SMS, a publicação de pedidos depende da confirmação manual do contato pela administração. Use **Conferir confirmação** depois da análise.

## Profissional

**Seja um profissional** abre diretamente o cadastro. Além da conta, informe CPF/CNPJ e uma apresentação sem contatos públicos. Selecione profissões/serviços por busca e categoria: as opções vêm de `/v1/catalog`, com categorias e serviços ativos do PostgreSQL, e são novamente validadas na gravação.

Conta, perfil, cidades, serviços e carteira vazia são gravados na mesma transação. Erros ou cadastros concorrentes não deixam perfis parciais nem geram moedas. CPF e CNPJ têm validação de dígitos, incluindo CNPJ alfanumérico; isso não substitui análise documental. Documento e contatos são restritos ao titular e à administração.

O painel **Meu perfil** reutiliza o mesmo seletor do catálogo e recupera os dados gravados. Alterar o documento exige nova análise. A liberação de contatos exige os requisitos existentes: telefone confirmado, aprovação profissional, saldo suficiente e disponibilidade do pedido. Preço Fechado continua com adesão própria no painel.

## Administração

Na aba **Cadastros e demonstração**:

- Confirme o telefone diretamente com a pessoa antes de clicar **Confirmar contato**. Registre o procedimento e marque a confirmação explícita. A ação é auditada e não é um envio de SMS.
- Use o controle **Acessos rápidos de demonstração** para mostrar/ocultar Cliente, Profissional e Admin no login. A mudança é persistida e auditada. Ocultar impede novas entradas rápidas; a sessão atual continua aberta para permitir reativar o controle.

A análise de CPF/CNPJ permanece na aba **Moderação**. Aprovação documental e confirmação de telefone são ações distintas.

## Ambientes

O `.env` local e o `NETLIFY.env` atual usam Supabase com `DATABASE_SCHEMA=elo_full_demo` e `DEMO_MODE=true`. A demonstração funciona online no Netlify enquanto o site recebe modificações. Ela recebeu os dados completos de `elo`, conforme [DEMONSTRACAO-DADOS.md](DEMONSTRACAO-DADOS.md); alterações locais e online compartilham o mesmo schema. Os schemas anteriores `elo` e `elo_demo` foram preservados. O perfil de operação real está separado em `NETLIFY.production.env`, com `DEMO_MODE=false`.

A API recusa demonstração PostgreSQL em schema sem sufixo `_demo`, exceto nos testes isolados. A hospedagem Netlify exige PostgreSQL, JWT próprio e migrations previamente aplicadas. O modo de execução `NODE_ENV=production` permite o ambiente de demonstração separado; a operação real com `DEMO_MODE=false` continua sem acesso rápido. Veja [PUBLICAR-NO-NETLIFY.md](../PUBLICAR-NO-NETLIFY.md).

## Primeiro administrador real

Cadastre uma conta de cliente dedicada à administração com e-mail e senha próprios. Depois, no terminal da raiz, com Node/pnpm no PATH e conexão configurada:

```powershell
$env:DATABASE_SCHEMA = 'elo'
pnpm.cmd admin-promote EMAIL-DA-CONTA-CADASTRADA
Remove-Item Env:DATABASE_SCHEMA
```

O comando é administrativo local, não é um endpoint público. Ele aceita somente uma conta de cliente ativa e real, registra a promoção e encerra suas sessões anteriores. Entre novamente com a senha cadastrada; não envie a senha pelo chat. Não use uma conta profissional com histórico para essa finalidade.

Para criar um administrador com senha no ambiente local de demonstração, use `pnpm.cmd admin-promote EMAIL-DA-CONTA` sem sobrescrever DATABASE_SCHEMA. Se ocultou os acessos rápidos e saiu antes de ter uma conta administrativa com senha, o proprietário do projeto pode recuperar somente a demonstração pelo terminal:

```powershell
pnpm.cmd demo-access on
```

Esse comando exige DEMO_MODE=true e schema com sufixo `_demo`, registra a ação e não permite abrir acesso rápido à produção.

## Banco e publicação

A migration `0006_registration_settings.sql` acrescenta cidade/bairro e configuração de demonstração com RLS. Já foi aplicada na Supabase em `elo`, `elo_demo` e `elo_full_demo`. Para outro banco, aplique migrations com credenciais administrativas antes do deploy; o build do Netlify não executa migrations.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 db-migrate
powershell -NoProfile -ExecutionPolicy Bypass -File .\make.ps1 check
```

Não foram adicionadas variáveis de SMS, conforme a escolha do usuário. Compras reais de moedas continuam dependendo de gateway de pagamento; esta mudança não habilita cobranças reais.

Referência para CNPJ alfanumérico: [manual de dígitos verificadores da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).
