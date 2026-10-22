#!/usr/bin/env python3
"""
Importa uma oferta já feita em Word (.docx) para o arquivo de projeto do app.

Serve para quem já tem as ofertas em tabelas no formato "uma tabela por turma":
  linha 1 = título da turma, linha 2 = HORÁRIO + dias, demais linhas = horário + células
  com "CÓDIGO NOME CHh – Prof. Fulano".

Uso:
  pip install python-docx
  python scripts/importar_docx.py OFERTA.docx projeto.json 2027.1 \
      --turmas 2027-BACH,2027-LIC,2026-BACH,2026-LIC,...

--turmas lista o id de turma de cada tabela, na ordem em que aparecem no .docx
(id = ANO_DE_INGRESSO-HABILITAÇÃO, como na aba Configurações). Repita o id quando a
mesma turma tiver duas tabelas (manhã e tarde, por exemplo).

O script:
  • lê o horário de cada célula a partir da coluna HORÁRIO (os horários do projeto);
  • reconhece docentes pelo nome curto ou completo cadastrado no projeto;
  • completa código e CH pela matriz da turma quando a célula não traz;
  • junta células iguais em várias turmas como turma conjunta.
O resultado deve ser conferido no app (aba Pendências).
"""
import argparse, json, re, sys, unicodedata
from docx import Document


def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', s).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('docx'); ap.add_argument('projeto'); ap.add_argument('semestre')
    ap.add_argument('--turmas', required=True)
    a = ap.parse_args()

    proj = json.load(open(a.projeto, encoding='utf-8'))
    cfg = proj['config']
    m = re.match(r'(\d{4})\.([12])$', a.semestre)
    if not m: sys.exit('Semestre deve ser no formato 2027.1')
    ano, per = int(m.group(1)), int(m.group(2))
    sid = f'{ano}-{per}'
    if any(s['id'] == sid for s in proj['semestres']): sys.exit(f'O semestre {a.semestre} já existe no projeto.')
    ids = [x.strip() for x in a.turmas.split(',') if x.strip()]

    hora_slot = {}
    for tn in cfg['turnos']:
        for sl in tn['slots']: hora_slot.setdefault(sl['inicio'], sl['id'])

    chaves = []  # (padrão normalizado, id do docente)
    contagem = {}
    for d in proj['docentes']:
        for tok in set(norm(d['nome'] + ' ' + d['curto']).split()):
            contagem[tok] = contagem.get(tok, 0) + 1
    for d in proj['docentes']:
        for nome in {d['curto'], d['nome'], ' '.join(d['nome'].split()[:2])}:
            n = norm(nome)
            if len(n) >= 4: chaves.append((n, d['id']))
        # palavras do nome que só esse docente tem (ex.: "Breno", "Barata")
        for tok in set(norm(d['nome'] + ' ' + d['curto']).split()):
            if len(tok) >= 5 and contagem[tok] == 1: chaves.append((tok, d['id']))
    chaves.sort(key=lambda x: -len(x[0]))

    def docentes_em(txt):
        n = ' ' + norm(txt) + ' '
        achados = []
        for k, did in chaves:
            if re.search(r'\b' + re.escape(k) + r'\b', n) and did not in achados:
                achados.append(did); n = n.replace(k, ' ')
        return achados

    def matriz_da(tid):
        ing, hab = tid.split('-')
        for mt in cfg['matrizes']:
            if mt['habilitacao'] == hab and mt['ingressoDe'] <= int(ing) <= mt['ingressoAte']: return mt

    def buscar(tid, codigo, nome):
        mt = matriz_da(tid)
        todas = ([mt] if mt else []) + [x for x in cfg['matrizes'] if x is not mt]
        for x in todas:
            for c in x['componentes']:
                if codigo and c['codigo'] == codigo: return c
        if nome and mt:
            n = norm(nome)
            for c in mt['componentes']:
                if norm(c['nome']) == n: return c
            for c in mt['componentes']:
                if n.startswith(norm(c['nome']) + ' '): return c

    doc = Document(a.docx)
    aulas = {}
    for ti, tab in enumerate(doc.tables[:len(ids)]):
        tid = ids[ti]
        for row in tab.rows[2:]:
            cells = row.cells
            mh = re.match(r'(\d\d:\d\d)', cells[0].text.strip())
            if not mh or mh.group(1) not in hora_slot: continue
            slot = hora_slot[mh.group(1)]
            for di in range(len(cfg['dias'])):
                if di + 1 >= len(cells): break
                x = re.sub(r'\s+', ' ', cells[di + 1].text.replace('\t', ' ')).strip()
                if not x or x.upper().startswith('TURNO'): continue
                mc = re.match(r'^([A-Z]{2,4}\d{3,5})\s+(.*)$', x)
                codigo, resto = (mc.group(1), mc.group(2)) if mc else ('', x)
                mch = re.search(r'^(.*?)[\s–-]*(\d{2,3})\s*(?:h\b|(?=\s*[–-]|\s*$))\s*[–-]?\s*(.*)$', resto)
                if mch: nome, ch, dtxt = mch.group(1), int(mch.group(2)), mch.group(3)
                else:
                    partes = re.split(r'\s+[–-]\s+|(?=Prof)', resto, maxsplit=1)
                    nome, ch, dtxt = partes[0], 0, partes[1] if len(partes) > 1 else ''
                nome = nome.strip(' –-')
                ds = docentes_em(dtxt)
                ref = buscar(tid, codigo, nome)
                if ref:
                    codigo = codigo or ref['codigo']; ch = ch or ref['ch']; nome = ref['nome']
                chave = (codigo or norm(nome)) + '|' + ','.join(sorted(ds))
                au = aulas.setdefault(chave, dict(codigo=codigo, nome=nome.title() if nome.isupper() else nome, ch=ch, docentes=ds, turmas=[], horarios=[]))
                if tid not in au['turmas']: au['turmas'].append(tid)
                h = f'{di}-{slot}'
                if h not in au['horarios']: au['horarios'].append(h)

    # junta células do mesmo componente em que o nome do docente aparece só em algumas linhas
    grupos = {}
    for au in aulas.values(): grupos.setdefault((au['codigo'], tuple(sorted(au['turmas']))), []).append(au)
    final = []
    for (cod, _), g in grupos.items():
        com = [x for x in g if x['docentes']]
        sem_d = [x for x in g if not x['docentes']]
        if cod and com and sem_d:
            base = com[0]
            for x in sem_d + com[1:]:
                base['horarios'] += [h for h in x['horarios'] if h not in base['horarios']]
                base['docentes'] = sorted(set(base['docentes']) | set(x['docentes']))
            final.append(base)
        elif cod and len(com) > 1:
            base = com[0]
            for x in com[1:]:
                base['horarios'] += [h for h in x['horarios'] if h not in base['horarios']]
                base['docentes'] = sorted(set(base['docentes']) | set(x['docentes']))
            final.append(base)
        else: final += g
    aulas = {i: x for i, x in enumerate(final)}

    turmas = sorted({t for t in ids}, key=lambda t: (-int(t.split('-')[0]), t))
    sem = dict(id=sid, rotulo=a.semestre, ano=ano, periodo=per, status='Em elaboração',
               turmas=[dict(id=t, ingresso=int(t.split('-')[0]), habilitacao=t.split('-')[1], nota='') for t in turmas],
               aulas=[dict(id=f'imp{i+1:03d}', codigo=x['codigo'], nome=x['nome'], ch=x['ch'], turmas=x['turmas'],
                           alocacao=[dict(docente=d, ch=x['ch']) for d in x['docentes']], horarios=x['horarios'],
                           moduloLivre=False, externo=False, colegiado='', optativa=False, obs='') for i, x in enumerate(aulas.values())],
               chPrevista={}, funcoes={}, pendencias=[], ignorados=[], versoes=[], atualizadoEm='')
    proj['semestres'].append(sem)
    proj['semestres'].sort(key=lambda s: (s['ano'], s['periodo']))
    json.dump(proj, open(a.projeto, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(sem["aulas"])} componentes importados para {a.semestre}. Abra o projeto no app e confira a aba Pendências.')


if __name__ == '__main__':
    main()
