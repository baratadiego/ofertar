# Formato do arquivo de projeto (`.json`)

O Ofertar guarda tudo de um curso num único arquivo JSON. Ele pode ser versionado, copiado entre computadores e lido por outros programas. A definição completa está em [`src/lib/types.ts`](../src/lib/types.ts). Exemplo: [`exemplos/curso-exemplo.json`](../exemplos/curso-exemplo.json).

```text
Projeto
├── formato        "ofertas-curso/1"
├── config         dados do curso (ver abaixo)
├── docentes[]     cadastro de docentes, comum a todos os semestres
└── semestres[]    um item por semestre letivo
```

## `config`

| Campo | Descrição |
|---|---|
| `instituicao`, `unidade`, `curso`, `sigla` | Identificação usada nos documentos |
| `habilitacoes[]` | `{ id, nome, abrev, coordenador }`. Ex.: `BACH`, `LIC` |
| `niveis` | Número de períodos do curso |
| `chPorAulaSemanal` | CH semestral ÷ este valor = aulas por semana (ex.: 15) |
| `chMinimaEnsino` | CH mínima de ensino por docente no semestre (graduação + pós) |
| `dias[]` | Rótulos dos dias (ex.: `2ª feira` … `Sábado`) |
| `turnos[]` | `{ id: "M" \| "T" \| "N", nome, slots: [{ id: "M1", inicio: "07:30", fim: "08:20" }] }` |
| `matrizes[]` | `{ id, habilitacao, nome, ingressoDe, ingressoAte, componentes: [{ codigo, nome, ch, nivel, natureza }] }` |
| `quadroDepartamento` | `{ cabecalho, orientacoes }`, uma linha por item |

## `docentes[]`

`{ id, nome, curto, tratamento, vinculo: "curso" | "externo", situacao: "ativo" | "afastado" | "dispensado", obs }`

## `semestres[]`

| Campo | Descrição |
|---|---|
| `id`, `rotulo`, `ano`, `periodo` | Ex.: `"2027-1"`, `"2027.1"`, `2027`, `1` |
| `turmas[]` | `{ id: "2026-BACH", ingresso, habilitacao, nota, cor }`. O período da turma é calculado: `(ano − ingresso) × 2 + periodo` |
| `aulas[]` | Componentes ofertados (ver abaixo) |
| `chPrevista`, `chPos`, `funcoes`, `reducaoPaid` | Por id de docente: CH prevista (PAID), CH na pós, função e redução PAID |
| `pendencias[]` | Lembretes da coordenação |
| `ignorados[]` | Pendências automáticas marcadas como "ciente" |
| `versoes[]` | Cópias guardadas da oferta, para comparação |

### Componente ofertado (`aulas[]`)

```json
{
  "id": "a01",
  "codigo": "DCBS0322",
  "nome": "Histologia e Hematologia",
  "ch": 75,
  "turmas": ["2026-BACH"],
  "alocacao": [{ "docente": "d3", "ch": 75 }],
  "horarios": ["0-M1", "0-M2", "0-M3", "0-M4", "0-M5"],
  "moduloLivre": false,
  "externo": false,
  "colegiado": "",
  "optativa": false,
  "obs": ""
}
```

`horarios` usa `dia-slot`: o dia é o índice em `config.dias` (0 = segunda) e o slot é o id em `config.turnos`. No quadro do Departamento, o horário é convertido para o padrão Sigaa: `0-M1…0-M5` → segunda `M12345`.

## Matriz em CSV

Para importar pela tela, uma linha por componente: `nivel;codigo;nome;ch;natureza` (cabeçalho opcional; aceita `;`, `,` ou tabulação). Modelo: [`exemplos/modelo-matriz.csv`](../exemplos/modelo-matriz.csv).
