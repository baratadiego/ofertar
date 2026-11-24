# Histórico de versões

## 1.1.0 — novembro de 2026

- Docentes: o botão **Horário** abre uma janela com os dados do docente (vínculo, situação, CH na graduação e na pós, total, prevista, aulas por semana e dias), a lista de componentes com turmas, CH e horário, e o quadro da semana com choques destacados.
- O horário também está disponível para docentes de outros colegiados e para afastados que ainda têm componentes alocados.
- **Ver na grade** leva ao componente; **Copiar resumo** copia a lista de componentes e horários para enviar ao docente.
- Manual atualizado.

## 1.0.1 — outubro de 2026

- DOI do Zenodo no README (selo), no `CITATION.cff`, no manual e na tela de abertura do app.
- Manual e citações atualizados.
- Documentação da arquitetura em camadas, do modelo de dados e do fluxo de trabalho, com diagramas (`docs/arquitetura.md`).

## 1.0.0 — outubro de 2026

Primeira versão pública.

- Grade semanal por turma (manhã, tarde e noite), com marcação de horários por clique, turmas conjuntas, vários docentes por componente, módulo livre e optativas.
- Conferência automática: choques de horário (docente e turma), docente afastado alocado, CH do docente maior que a do componente, aulas por semana × CH, componentes sem docente, CH alocada × prevista (PAID) e mínimo de ensino, obrigatórias fora da oferta, códigos fora da matriz.
- Aba Docentes com CH de graduação e pós-graduação, função e redução PAID.
- Matrizes por habilitação e ano de ingresso, com importação por CSV e modelo para baixar.
- Versões da oferta com comparação.
- Documentos: Word para discentes e docentes, quadro de ofertas para o Departamento (horário no padrão Sigaa), CSV de carga horária e rascunho de memorando por colegiado. Os documentos em Word trazem rodapé com a versão do app, a data e a hora da geração e a numeração de páginas.
- Novo semestre reaproveitando o mesmo período do ano anterior.
- Cores dos quadros por ano de ingresso; tema claro e escuro; menu e painéis recolhíveis.
- App instalável (PWA) e de uso offline; também funciona como arquivo único aberto do computador.
- Script para importar ofertas antigas em `.docx`.
- Segurança: cabeçalhos HTTP restritivos (CSP, anti-iframe), conferência da estrutura do arquivo `.json` ao abrir e política de segurança (`SECURITY.md`).
