# Histórico de versões

## 1.0.1 — outubro de 2026

- DOI do Zenodo no README (selo), no `CITATION.cff`, no manual e na tela de abertura do app.
- Manual e citações atualizados.

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
