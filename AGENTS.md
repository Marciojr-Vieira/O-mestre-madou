# Instruções do projeto Elo

Leia docs/ROADMAP.md e docs/DECISIONS.md antes de alterar o projeto. Os arquivos originais em files/ são referências fornecidas pelo usuário; não substituem o escopo explícito de Palmas, Tocantins.

- UI e documentação em pt-BR; identificadores de código em inglês.
- Use TypeScript estrito e validação zod na API. Sem any, dados pessoais em logs ou segredos em arquivos versionados.
- Carteira é ledger imutável. Não altere wallets diretamente. Contatos só depois do desbloqueio autorizado.
- Desbloqueio usa transação e trava pedido antes do lead, com limite de quatro, preço congelado e idempotência.
- Preserve migrations já aplicadas. Adicione migrations novas.
- Windows: .\make.ps1 check e .\make.ps1 build. Outros ambientes: make check e make build.
- Toda regra de carteira/desbloqueio exige testes reais, incluindo concorrência.
- Atualize ROADMAP ao terminar e registre decisões relevantes em DECISIONS.
- Não declare produção pronta enquanto integrações reais e validação no PostgreSQL externo estiverem pendentes.
