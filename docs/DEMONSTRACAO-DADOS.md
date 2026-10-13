# Dados e acesso à demonstração

O site usa `elo_full_demo` na Supabase. A cópia de `elo` foi feita em 13/10/2026 com snapshot consistente, backup privado em `.data/backups/`, transação de importação e conferência de todas as tabelas copiadas. Os schemas `elo` e `elo_demo` foram preservados.

Foram copiados 111 serviços, dez categorias, 14 pedidos, 84 leads, seis profissionais, uma oferta fixa, associações de serviços/cobertura, notificações e oito lançamentos de moedas. As oito contas originais usam o domínio fictício de demonstração. O novo administrador pessoal é uma conta adicional com senha aleatória, gravada somente como hash no banco. Suas credenciais estão em `.data/ACESSO-ADM-elo_full_demo.txt`, fora do Git. Use a tela normal de login para entrar com esse e-mail e senha.

As carteiras são reconstruídas pelos gatilhos de inserção no ledger, sem atualização direta de saldo. A importação compara os registros e saldos com o snapshot e verifica os contadores de desbloqueio. Sessões ativas e códigos de telefone não são copiados. As configurações de demonstração são persistentes; os atalhos compartilhados continuam sob controle do ADM.

## Operações administrativas locais

Com Node/pnpm no PATH, na raiz do projeto:

```powershell
# Cria uma NOVA cópia. Recusa qualquer schema que já exista.
pnpm.cmd demo-copy-production nome_novo_demo

# Criar outro ADM somente no schema de demonstração selecionado no .env.
# Recusa conta ou arquivo de credenciais existentes; não redefine senhas.
pnpm.cmd demo-admin-create EMAIL-DO-PROPRIETARIO

pnpm.cmd db-verify
```

Uma nova cópia não troca automaticamente o banco do site. Primeiro valide o destino e então configure `DATABASE_SCHEMA` nos perfis de demonstração e no Netlify. Migrations são aplicadas antes da cópia; a Function continua com `DATABASE_MIGRATE=false`.

O site em demonstração simula telefone e compra de moedas. Checkout real de serviços, gateway financeiro e SMS reais continuam fora desta entrega.

## Verificação publicada em 13/10/2026

Deploy `6ace6dc1c2f868a45e9766a9`, commit `3eddef4`, em https://o-mestre-mandou.netlify.app. API sem os erros 502 anteriores; catálogo e oferta fixa consultados, ADM autenticado por senha, cookies HTTPS/refresh conferidos, acessos rápidos e controle administrativo testados. Compra simulada e liberação de contato verificadas com repetição da mesma operação para confirmar que não há crédito/débito duplicado. Um pedido demonstrativo e um pagamento simulado permanecem no banco como resultado do teste; nenhum valor real foi cobrado.

Quarenta testes automatizados passaram. Chromium verificou a interface desktop/celular, entrada do ADM e logout sem erros de JavaScript ou respostas 5xx. Relatório local em `output/netlify/live-validation.json` e capturas em `output/playwright/netlify-demo-*.png`.
