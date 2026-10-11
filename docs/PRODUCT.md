# Produto e regras de negócio

## Modelo

- **Cliente** descreve o que precisa (grátis) e recebe contato de **até 4 profissionais**.
- **Profissional** vê os pedidos compatíveis sem pagar e **desbloqueia** o contato do cliente gastando **moedas**.
- A plataforma **não cobra comissão nem mensalidade**: a receita vem 100% da venda de moedas (pacotes via Pix/cartão).
- O catálogo é hierárquico: Categoria → Serviço (ex.: Reformas e Reparos → Eletricista). Cada serviço tem seu próprio formulário de pedido (`service_questions`).

## Atores

| Ator | Papel |
|---|---|
| `client` | Cria pedidos, recebe contatos, avalia o profissional |
| `pro` | Define serviços e cidades atendidas, compra moedas, desbloqueia leads, responde avaliações |
| `admin` | Catálogo, preços de lead, moderação, reembolsos, financeiro |

## Glossário (pt-BR ↔ código)

| Termo | Código |
|---|---|
| Pedido / solicitação | `request` |
| Lead (pedido ofertado a um profissional) | `lead` |
| Moeda | `coin` |
| Desbloquear contato | `unlock` |
| Pacote de moedas | `coin_package` |
| Profissional | `pro` / `professional` |
| Avaliação | `review` |

Use sempre estes nomes em código, rotas e tabelas.

## Regras (valores iniciais, ajustáveis em config)

1. Um pedido aceita no máximo `max_leads` (padrão **4**) desbloqueios; ao atingir, fica `closed`.
2. Um pedido `open` expira em **7 dias** (`expires_at`) se não fechar antes.
3. O profissional só recebe leads de serviços e cidades que ele cadastrou.
4. Ver o pedido (serviço, cidade, descrição, respostas) é grátis. **Dados de contato** só após desbloqueio.
5. Preço do lead (em moedas) vem de `lead_pricing_rules` (regra por serviço+cidade, com fallback por serviço) e é congelado em `leads.coin_cost` na oferta.
6. **Reembolso de moedas:** o profissional pode abrir `refund_requests` se o contato for inválido/falso. Aprovado → crédito `refund` no ledger e lead `refunded`.
7. Avaliação só existe para leads `unlocked`/`won`, uma por lead, e passa por moderação (`pending` → `published`).
8. Pacotes iniciais (seed): Básico 20 moedas (R$ 20,00), Plus 60 (R$ 54,00), Pro 150 (R$ 112,50).

## Estratégia de lançamento

Lançamento em **Palmas, Tocantins**, conforme solicitação explícita do usuário em 06/10/2026. Catálogo inicial com **10 categorias e 111 serviços**, seguindo as categorias da referência pesquisada. Diarista, Eletricista e Encanador têm perguntas específicas; os demais começam com modalidade de atendimento e descrição. Outras cidades entram quando houver cobertura profissional.

## Estado da implementação

As regras principais estão implementadas na base local. Pix/cartão e OTP usam adaptadores de demonstração explícitos; não há cobrança real ou envio de SMS. Notificações são exibidas dentro da conta. Verificação documental é administrativa/manual. Detalhes e integrações pendentes em `ROADMAP.md` e `DECISIONS.md`.

## Fora do escopo do MVP

Atualização de 07/10/2026: conforme novo pedido do usuário, **Preço Fechado para consulta** está implementado. O profissional habilita a opção, cadastra ofertas para seus serviços em Palmas, define valor, escopo e unidade e pode editar, pausar ou excluir. A aba pública permite busca e filtro por categoria; publicação exige cadastro aprovado e telefone verificado. Pagamento retido e checkout de serviços permanecem como expansão.

Chat interno, "Preço Fechado" (pagamento retido), preço dinâmico, app nativo, ranking por ML.
