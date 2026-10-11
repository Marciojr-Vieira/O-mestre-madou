# Validação dos cadastros

11/10/2026. Os formulários usam a identidade visual existente de O Mestre Mandou: verde profundo, branco, campos legíveis, ícones Lucide e componentes nativos. As etapas e os estados foram implementados em React, com gravação pela API NestJS.

Capturas finais inspecionadas em 1440×1000 e 390×900:

- [Cliente](client-desktop.png)
- [Profissional e catálogo pesquisável](professional-desktop.png)
- [Profissional no celular](professional-mobile.png)
- [Cadastros e demonstração no ADM](admin-desktop.png)

Conferidos: hierarquia dos títulos; contraste da paleta; tipografia dos campos e ajuda; alinhamento dos ícones e checkboxes; espaçamento e ações; navegação das etapas; rolagem do modal móvel sem overflow horizontal. Corrigidos checkbox empilhado no seletor, associação dos rótulos, foco do modal de termos e atualização assíncrona do controle de demonstração. Formulários longos têm rolagem interna no celular.

Chromium via Playwright, em banco temporário: cadastro de cliente com erro de confirmação de senha, retorno às etapas, leitura/fechamento dos termos sem perder o cadastro, criação da conta, OTP de demonstração, publicação de pedido, cadastro profissional completo, filtro por categoria, seleção mantida entre filtros e recuperada no perfil, logout e ativação/desativação de acessos rápidos no ADM. Nenhum erro de JavaScript. A conta/pedido do teste não foi gravada no banco principal nem no schema persistente de demonstração.

35 testes locais, lint e TypeScript aprovados. Suíte externa aprovada na Supabase em schemas temporários: migrations concorrentes, RLS, ledger, HTTP e os seis testes de cadastro, incluindo rollback, duplicidade concorrente, confirmação manual auditada e bloqueio de demonstração em schema real. Os schemas temporários foram removidos pelo orquestrador.

Build offline completo Netlify aprovado com 118 páginas e duas Functions. A API extraída do pacote final foi executada com Supabase real, schema elo, DEMO_MODE=false e TLS verificado. `/auth/options` informou demonstração bloqueada e confirmação manual; catálogo e ofertas fixas responderam corretamente. Nenhum registro real foi alterado na verificação do pacote.

Migration 0006 aplicada em elo e elo_demo. Demonstração local deixada na porta 3000. Dados de elo preservados, sem alterações de saldo ou lançamentos históricos. SMS não contratado conforme decisão do usuário; compra real de moedas continua pendente de gateway.
