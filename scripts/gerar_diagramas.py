"""Gera os diagramas do Ofertar em SVG (arquitetura, modelo de dados, fluxo de uso).

Uso: cd docs/diagramas && python3 ../../scripts/gerar_diagramas.py
"""
from xml.sax.saxutils import escape as esc

NAVY = '#0b3d84'; AZUL = '#1689e6'; CLARO = '#eef5fc'; VERDE = '#3fae74'; VERDE_C = '#e6f6ee'
TINTA = '#1d2733'; CINZA = '#5b6875'; LINHA = '#8aa0b6'; AMBAR = '#e9a23b'; AMBAR_C = '#fdf3e2'
FONTE = "font-family='Arial, Helvetica, sans-serif'"


class SVG:
    def __init__(self, w, h, titulo):
        self.w, self.h, self.el = w, h, []
        self.titulo = titulo

    def add(self, s):
        self.el.append(s)

    def rect(self, x, y, w, h, fill='#fff', stroke=LINHA, rx=14, sw=2, dash=None):
        d = f" stroke-dasharray='{dash}'" if dash else ''
        self.add(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='{rx}' fill='{fill}' stroke='{stroke}' stroke-width='{sw}'{d}/>")

    def text(self, x, y, t, size=18, weight='normal', color=TINTA, anchor='start', italic=False):
        st = " font-style='italic'" if italic else ''
        self.add(f"<text x='{x}' y='{y}' {FONTE} font-size='{size}' font-weight='{weight}' fill='{color}' text-anchor='{anchor}'{st}>{esc(t)}</text>")

    def lines(self, x, y, linhas, size=16, color=TINTA, anchor='start', lh=1.32, weight='normal'):
        for i, l in enumerate(linhas):
            self.text(x, y + i * size * lh, l, size, weight, color, anchor)

    def cyl(self, x, y, w, h, fill, stroke, titulo, sub):
        ry = 14
        self.add(f"<path d='M{x} {y+ry} v{h-2*ry} a{w/2} {ry} 0 0 0 {w} 0 v{-(h-2*ry)}' fill='{fill}' stroke='{stroke}' stroke-width='2'/>")
        self.add(f"<ellipse cx='{x+w/2}' cy='{y+ry}' rx='{w/2}' ry='{ry}' fill='#ffffff' stroke='{stroke}' stroke-width='2'/>")
        self.text(x + w / 2, y + ry + 38, titulo, 17, 'bold', TINTA, 'middle')
        self.lines(x + w / 2, y + ry + 62, sub, 14, CINZA, 'middle')

    def arrow(self, pts, color=LINHA, sw=2.5, dash=None, both=False, label=None, lpos=None, lsize=14):
        d = 'M' + ' L'.join(f'{a} {b}' for a, b in pts)
        da = f" stroke-dasharray='{dash}'" if dash else ''
        ms = " marker-start='url(#ini)'" if both else ''
        self.add(f"<path d='{d}' fill='none' stroke='{color}' stroke-width='{sw}'{da} marker-end='url(#fim)'{ms}/>")
        if label:
            lx, ly = lpos
            self.text(lx, ly, label, lsize, 'normal', CINZA, 'middle', italic=True)

    def chip(self, x, y, t, fill, stroke, size=15, h=34, pad=14):
        w = int(len(t) * size * 0.56 + pad * 2)
        self.rect(x, y, w, h, fill, stroke, 17, 1.5)
        self.text(x + w / 2, y + h / 2 + size * 0.35, t, size, 'normal', TINTA, 'middle')
        return w

    def save(self, path):
        defs = f"""<defs>
  <marker id='fim' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' fill='{LINHA}'/></marker>
  <marker id='ini' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' fill='{LINHA}'/></marker>
</defs>"""
        body = '\n'.join(self.el)
        open(path, 'w').write(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {self.w} {self.h}' width='{self.w}' height='{self.h}'>\n<title>{esc(self.titulo)}</title>\n{defs}\n<rect width='{self.w}' height='{self.h}' fill='#ffffff'/>\n{body}\n</svg>\n")


# ------------------------------------------------------------------ 1. Arquitetura
def arquitetura(path):
    s = SVG(1640, 1180, 'Ofertar – arquitetura em camadas')
    # faixa superior: distribuição
    s.text(40, 46, 'DISTRIBUIÇÃO DO PROGRAMA', 15, 'bold', CINZA)
    s.rect(40, 62, 330, 108, CLARO, NAVY)
    s.text(60, 98, 'GitHub', 20, 'bold', NAVY); s.lines(60, 124, ['Código-fonte, manual e', 'histórico de versões (MIT)'], 15, CINZA)
    s.rect(470, 62, 380, 108, CLARO, NAVY)
    s.text(490, 98, 'Vercel – hospedagem estática', 20, 'bold', NAVY); s.lines(490, 124, ['index.html único, manifesto,', 'ícones e service worker'], 15, CINZA)
    s.rect(950, 62, 330, 108, CLARO, NAVY)
    s.text(970, 98, 'Zenodo', 20, 'bold', NAVY); s.lines(970, 124, ['Arquivamento de cada versão', 'com DOI'], 15, CINZA)
    s.arrow([(370, 116), (468, 116)], label='build e deploy', lpos=(419, 106), lsize=13)
    s.arrow([(205, 170), (205, 196), (1115, 196), (1115, 172)], dash='6 5')
    s.text(1000, 190, 'cada release gera um DOI', 13, 'normal', CINZA, 'middle', True)
    s.arrow([(660, 170), (660, 262)], color=NAVY, sw=3)
    s.rect(680, 226, 410, 30, '#ffffff', '#ffffff', 4, 0)
    s.text(684, 247, 'HTTPS: entrega apenas o programa — nenhum dado da oferta', 14, 'bold', NAVY)

    # contêiner do navegador
    X, Y, W, H = 40, 270, 1100, 860
    s.rect(X, Y, W, H, '#fbfdff', NAVY, 22, 2.5)
    s.text(X + 24, Y + 38, 'NAVEGADOR DA COORDENAÇÃO', 17, 'bold', NAVY)
    s.text(X + 330, Y + 38, '(aplicação web progressiva: instalável e com uso offline)', 15, 'normal', CINZA)

    def camada(y, h, n, titulo, sub, fill, stroke):
        s.rect(X + 24, y, W - 48, h, fill, stroke, 16, 2)
        s.rect(X + 24, y, 58, h, stroke, stroke, 16, 0)
        s.rect(X + 60, y, 22, h, stroke, stroke, 0, 0)
        s.text(X + 53, y + h / 2 + 10, str(n), 28, 'bold', '#ffffff', 'middle')
        s.text(X + 100, y + 32, titulo, 19, 'bold', TINTA)
        s.text(X + 100 + len(titulo) * 10.9, y + 32, sub, 15, 'normal', CINZA)

    # 1 apresentação
    camada(Y + 60, 150, 1, 'Apresentação', '   React + TypeScript · src/components', CLARO, AZUL)
    xx = X + 100
    for i, t in enumerate(['Início', 'Grade', 'Docentes', 'Matriz', 'Pendências', 'Versões', 'Documentos', 'Configurações']):
        if i == 5: xx = X + 100
        yy = Y + 108 if i < 5 else Y + 152
        xx += s.chip(xx, yy, t, '#ffffff', AZUL) + 10
    # 2 domínio
    camada(Y + 240, 190, 2, 'Domínio — regras do negócio', '   src/lib/model.ts', VERDE_C, VERDE)
    regras = [('Período da turma e', 'matriz por ingresso'), ('Conferência: choques,', 'CH, matriz, obrigatórias'), ('Distribuição da CH', 'docente (PAID)'), ('Diferenças entre', 'versões'), ('Novo semestre a partir', 'do ano anterior')]
    for i, (a, b) in enumerate(regras):
        bx = X + 100 + i * 192
        s.rect(bx, Y + 288, 180, 110, '#ffffff', VERDE, 12, 1.5)
        s.lines(bx + 90, Y + 330, [a, b], 14.5, TINTA, 'middle')
    # 3 serviços
    camada(Y + 460, 150, 3, 'Serviços', '   src/lib', AMBAR_C, AMBAR)
    s.rect(X + 560, Y + 506, 440, 84, '#ffffff', AMBAR, 12, 1.5)
    s.text(X + 580, Y + 536, 'exportar.ts — geração de documentos', 16, 'bold'); s.lines(X + 580, Y + 562, ['Word (biblioteca docx), CSV e memorando'], 14.5, CINZA)
    s.rect(X + 100, Y + 506, 440, 84, '#ffffff', AMBAR, 12, 1.5)
    s.text(X + 120, Y + 536, 'storage.ts — salvar e abrir', 16, 'bold'); s.lines(X + 120, Y + 562, ['validação do arquivo e importação de CSV'], 14.5, CINZA)
    # 4 persistência
    camada(Y + 640, 196, 4, 'Persistência local', '   sem servidor e sem banco de dados remoto', '#f4f6f9', '#6b7d90')
    s.cyl(X + 110, Y + 690, 270, 132, '#eef2f6', '#6b7d90', 'localStorage', ['salvamento automático', 'a cada alteração'])
    s.cyl(X + 730, Y + 690, 270, 132, '#eef2f6', '#6b7d90', 'Arquivo de projeto', ['.json (formato ofertas-curso/1)', 'File System Access API'])
    s.cyl(X + 420, Y + 690, 270, 132, '#eef2f6', '#6b7d90', 'Cache do service worker', ['programa disponível', 'sem internet'])

    # setas entre camadas
    for y1, y2 in [(Y + 210, Y + 240), (Y + 430, Y + 460), (Y + 610, Y + 640)]:
        s.arrow([(X + W / 2 - 40, y1 + 2), (X + W / 2 - 40, y2 - 2)], color=TINTA, sw=2)
        s.arrow([(X + W / 2 + 40, y2 - 2), (X + W / 2 + 40, y1 + 2)], color=TINTA, sw=2)

    # coluna direita
    RX = 1190
    s.text(RX, Y + 38, 'FORA DO NAVEGADOR', 17, 'bold', CINZA)
    s.rect(RX, Y + 60, 410, 220, '#ffffff', LINHA, 14, 2)
    s.text(RX + 20, Y + 94, 'Documentos gerados', 18, 'bold')
    s.lines(RX + 20, Y + 124, ['Oferta para discentes (.docx)', 'Oferta para docentes (.docx)', 'Quadro do Departamento (.docx)', 'Planilha de carga horária (.csv)', 'Rascunho de memorando (texto)'], 15, TINTA)
    s.rect(RX, Y + 320, 410, 110, '#ffffff', LINHA, 14, 2)
    s.text(RX + 20, Y + 354, 'Destinatários', 18, 'bold'); s.lines(RX + 20, Y + 382, ['Discentes · Docentes · Departamento', 'Colegiados de outros cursos'], 15, CINZA)
    s.arrow([(RX + 205, Y + 280), (RX + 205, Y + 318)])
    s.rect(RX, Y + 470, 410, 150, '#ffffff', LINHA, 14, 2)
    s.text(RX + 20, Y + 504, 'Pasta institucional', 18, 'bold'); s.lines(RX + 20, Y + 532, ['OneDrive, Google Drive ou rede', 'projeto.json: cópia de segurança e', 'passagem entre coordenações'], 15, CINZA)
    s.rect(RX, Y + 690, 410, 132, '#ffffff', LINHA, 14, 2, dash='7 5')
    s.text(RX + 20, Y + 724, 'importar_docx.py (Python)', 18, 'bold'); s.lines(RX + 20, Y + 752, ['converte ofertas antigas, feitas', 'em Word, para o arquivo .json'], 15, CINZA)

    s.arrow([(X + 1000, Y + 548), (1150, Y + 548), (1150, Y + 170), (RX - 4, Y + 170)])
    s.arrow([(X + 1000, Y + 735), (1165, Y + 735), (1165, Y + 545), (RX - 4, Y + 545)], both=True)
    s.text(1098, Y + 724, 'salvar / abrir', 13, 'normal', CINZA, 'middle', True)
    s.arrow([(RX - 2, Y + 790), (X + 1004, Y + 790)], dash='6 5')
    s.save(path)


# ------------------------------------------------------------------ 2. Modelo de dados
def entidade(s, x, y, w, nome, campos, cor=NAVY, fill=CLARO):
    h = 46 + len(campos) * 24 + 12
    s.rect(x, y, w, h, '#ffffff', cor, 10, 2)
    s.rect(x, y, w, 40, cor, cor, 10, 0); s.rect(x, y + 20, w, 20, cor, cor, 0, 0)
    s.text(x + w / 2, y + 27, nome, 18, 'bold', '#ffffff', 'middle')
    for i, c in enumerate(campos):
        chave = c.startswith('*')
        s.text(x + 14, y + 66 + i * 24, c.lstrip('*'), 14.5, 'bold' if chave else 'normal', TINTA if chave else CINZA)
    return (x, y, w, h)


def rel(s, pts, card1, card2, p1, p2):
    s.add("<path d='M" + ' L'.join(f'{a} {b}' for a, b in pts) + f"' fill='none' stroke='{LINHA}' stroke-width='2.2'/>")
    s.text(p1[0], p1[1], card1, 15, 'bold', NAVY, 'middle'); s.text(p2[0], p2[1], card2, 15, 'bold', NAVY, 'middle')


def modelo(path):
    s = SVG(1640, 1060, 'Ofertar – modelo de dados do arquivo de projeto')
    s.text(40, 46, 'MODELO DE DADOS — arquivo de projeto .json (formato ofertas-curso/1)', 17, 'bold', CINZA)
    P = entidade(s, 690, 70, 260, 'Projeto', ['*formato', 'config', 'docentes[ ]', 'semestres[ ]'])
    C = entidade(s, 150, 280, 300, 'Config', ['*curso, sigla, instituição', 'chPorAulaSemanal', 'chMinimaEnsino', 'dias[ ], turnos[ ]', 'quadroDepartamento'])
    S = entidade(s, 690, 280, 260, 'Semestre', ['*id (ex.: 2027-1)', 'ano, período, status', 'chPrevista {docente}', 'chPos {docente}', 'reducaoPaid {docente}', 'funções {docente}', 'ignorados[ ]'], VERDE)
    V = entidade(s, 1010, 330, 190, 'Versão', ['*id, nome', 'criadaEm', 'snapshot'], VERDE)
    D = entidade(s, 1290, 280, 300, 'Docente', ['*id', 'nome, tratamento', 'vínculo: curso | externo', 'situação: ativo | afastado', '    | dispensado'])
    H = entidade(s, 40, 600, 220, 'Habilitação', ['*id (LIC, BACH)', 'nome, abrev', 'coordenador'])
    M = entidade(s, 310, 600, 240, 'Matriz', ['*id', 'habilitação', 'ingressoDe, ingressoAte'])
    TS = entidade(s, 40, 830, 220, 'Turno → Slot', ['*id (M, T, N)', 'slots: id, início, fim'])
    CM = entidade(s, 310, 830, 240, 'ComponenteMatriz', ['*código', 'nome, CH', 'nível (período)', 'natureza'])
    T = entidade(s, 620, 620, 220, 'Turma', ['*id (2026-BACH)', 'ingresso', 'habilitação', 'cor'], VERDE)
    A = entidade(s, 900, 620, 290, 'Aula (componente ofertado)', ['*id, código, nome, CH', 'turmas[ ]', 'horários[ ] "dia-slot"', 'móduloLivre, optativa', 'externo, colegiado'], VERDE)
    AL = entidade(s, 1290, 660, 220, 'Alocação', ['*docente', 'CH'], VERDE)
    bot = lambda E: E[1] + E[3]
    # Projeto
    rel(s, [(P[0], 140), (300, 140), (300, C[1])], '1', '1', (P[0]-14, 132), (314, C[1]-8))
    rel(s, [(P[0]+P[2], 140), (1440, 140), (1440, D[1])], '1', 'N', (P[0]+P[2]+14, 132), (1454, D[1]-8))
    rel(s, [(820, bot(P)), (820, S[1])], '1', 'N', (834, bot(P)+18), (834, S[1]-8))
    # Config
    rel(s, [(200, bot(C)), (200, 560), (150, 560), (150, H[1])], '1', 'N', (214, bot(C)+18), (164, H[1]-8))
    rel(s, [(300, bot(C)), (300, 560), (430, 560), (430, M[1])], '', 'N', (0, 0), (444, M[1]-8))
    rel(s, [(170, bot(C)), (170, 540), (25, 540), (25, 880), (TS[0], 880)], '', 'N', (0, 0), (TS[0]-12, 872))
    rel(s, [(H[0]+H[2], 660), (M[0], 660)], '1', 'N', (H[0]+H[2]+12, 652), (M[0]-12, 652))
    rel(s, [(430, bot(M)), (430, CM[1])], '1', 'N', (444, bot(M)+18), (444, CM[1]-8))
    # Semestre
    rel(s, [(S[0]+S[2], 400), (V[0], 400)], '1', 'N', (S[0]+S[2]+12, 392), (V[0]-12, 392))
    rel(s, [(730, bot(S)), (730, T[1])], '1', 'N', (744, bot(S)+18), (744, T[1]-8))
    rel(s, [(S[0]+S[2], bot(S)-30), (1045, bot(S)-30), (1045, A[1])], '1', 'N', (S[0]+S[2]+12, bot(S)-38), (1059, A[1]-8))
    rel(s, [(T[0]+T[2], 700), (A[0], 700)], 'N', 'N', (T[0]+T[2]+12, 692), (A[0]-12, 692))
    rel(s, [(A[0]+A[2], 720), (AL[0], 720)], '1', 'N', (A[0]+A[2]+12, 712), (AL[0]-12, 712))
    rel(s, [(1400, AL[1]), (1400, bot(D))], 'N', '1', (1414, AL[1]-8), (1414, bot(D)+18))
    # relações calculadas
    s.add(f"<path d='M{T[0]} 760 L580 760 L580 700 L{M[0]+M[2]+4} 700' fill='none' stroke='{AZUL}' stroke-width='2' stroke-dasharray='6 5' marker-end='url(#fim)'/>")
    s.text(585, 790, 'matriz pela faixa', 13, 'normal', AZUL, 'middle', True); s.text(585, 806, 'de ingresso', 13, 'normal', AZUL, 'middle', True)
    s.add(f"<path d='M980 {bot(A)} L980 900 L{CM[0]+CM[2]+4} 900' fill='none' stroke='{AZUL}' stroke-width='2' stroke-dasharray='6 5' marker-end='url(#fim)'/>")
    s.text(760, 892, 'código conferido na matriz da turma', 13, 'normal', AZUL, 'middle', True)
    s.add(f"<path d='M1080 {bot(A)} L1080 1010 L150 1010 L150 {bot(TS)+4}' fill='none' stroke='{AZUL}' stroke-width='2' stroke-dasharray='6 5' marker-end='url(#fim)'/>")
    s.text(620, 1032, 'cada horário "dia-slot" aponta para um slot de um turno', 13, 'normal', AZUL, 'middle', True)
    # legenda
    s.rect(1200, 860, 400, 130, '#ffffff', LINHA, 10, 1.5)
    s.text(1220, 890, 'Legenda', 15, 'bold')
    s.add(f"<rect x='1220' y='904' width='22' height='14' fill='{NAVY}'/>"); s.text(1252, 916, 'configuração do curso (todos os semestres)', 13, 'normal', CINZA)
    s.add(f"<rect x='1220' y='930' width='22' height='14' fill='{VERDE}'/>"); s.text(1252, 942, 'dados de cada semestre', 13, 'normal', CINZA)
    s.add(f"<path d='M1220 966 L1244 966' stroke='{AZUL}' stroke-width='2' stroke-dasharray='6 5'/>"); s.text(1252, 970, 'relação calculada pelas regras do domínio', 13, 'normal', CINZA)
    s.save(path)


# ------------------------------------------------------------------ 3. Fluxo de uso
def fluxo(path):
    s = SVG(1640, 770, 'Ofertar – fluxo de trabalho da coordenação')
    s.text(40, 46, 'FLUXO DE TRABALHO DA COORDENAÇÃO', 17, 'bold', CINZA)

    def caixa(x, y, t, sub=None, fill=CLARO, stroke=NAVY, w=230, h=86):
        s.rect(x, y, w, h, fill, stroke, 14, 2)
        if sub:
            s.text(x + w / 2, y + 36, t, 16.5, 'bold', TINTA, 'middle'); s.lines(x + w / 2, y + 60, sub, 13.5, CINZA, 'middle')
        else:
            s.text(x + w / 2, y + h / 2 + 6, t, 16.5, 'bold', TINTA, 'middle')
        return (x, y, w, h)

    def losango(cx, cy, t1, t2, w=200, h=120):
        s.add(f"<path d='M{cx} {cy-h/2} L{cx+w/2} {cy} L{cx} {cy+h/2} L{cx-w/2} {cy}Z' fill='{AMBAR_C}' stroke='{AMBAR}' stroke-width='2'/>")
        s.lines(cx, cy - 4, [t1, t2], 15, TINTA, 'middle', weight='bold')

    def ini(cx, cy, t):
        s.rect(cx - 90, cy - 26, 180, 52, NAVY, NAVY, 26, 0); s.text(cx, cy + 6, t, 16, 'bold', '#ffffff', 'middle')

    s.text(40, 92, 'Uma vez por curso', 14, 'bold', AZUL)
    ini(130, 140, 'Início')
    caixa(260, 97, 'Configurar o curso', ['habilitações, horários,', 'regras de CH'])
    caixa(530, 97, 'Importar matrizes', ['planilha CSV', '(modelo no app)'])
    caixa(800, 97, 'Cadastrar docentes', ['vínculo e situação'])
    s.arrow([(220, 140), (258, 140)]); s.arrow([(490, 140), (528, 140)]); s.arrow([(760, 140), (798, 140)])
    s.add(f"<path d='M30 210 L1610 210' stroke='{LINHA}' stroke-width='1.5' stroke-dasharray='4 6'/>")
    s.text(40, 246, 'A cada semestre', 14, 'bold', VERDE)
    s.arrow([(915, 183), (915, 230), (155, 230), (155, 270)])
    caixa(40, 272, 'Criar semestre', ['a partir do mesmo período', 'do ano anterior'], VERDE_C, VERDE)
    caixa(310, 272, 'Montar a grade', ['componente, turmas,', 'docentes e horários'], VERDE_C, VERDE)
    caixa(580, 272, 'Conferência', ['automática, a cada', 'alteração'], VERDE_C, VERDE)
    losango(940, 315, 'Há', 'pendências?')
    caixa(1110, 272, 'Corrigir', ['ou marcar como "ciente"'], VERDE_C, VERDE)
    s.arrow([(270, 315), (308, 315)]); s.arrow([(540, 315), (578, 315)]); s.arrow([(810, 315), (838, 315)])
    s.arrow([(1040, 315), (1108, 315)], label='sim', lpos=(1072, 304))
    s.arrow([(1225, 272), (1225, 240), (425, 240), (425, 270)])
    s.arrow([(940, 375), (940, 450)], label='não', lpos=(966, 418))
    caixa(825, 452, 'Salvar versão', ['cópia do que será enviado'], VERDE_C, VERDE)
    caixa(1110, 452, 'Gerar documentos', ['Word, CSV e memorando'], VERDE_C, VERDE)
    caixa(1380, 452, 'Enviar', ['discentes, docentes,', 'departamento, colegiados'], VERDE_C, VERDE, w=220)
    s.arrow([(1055, 495), (1108, 495)]); s.arrow([(1340, 495), (1378, 495)])
    losango(1490, 640, 'Houve', 'alterações?')
    s.arrow([(1490, 538), (1490, 578)])
    caixa(1060, 597, 'Comparar com a versão', ['lista do que mudou'], VERDE_C, VERDE, w=270)
    s.arrow([(1390, 640), (1332, 640)], label='sim', lpos=(1362, 630))
    s.arrow([(1060, 640), (425, 640), (425, 360)], label='ajustar a grade e reenviar', lpos=(740, 630))
    s.arrow([(1490, 700), (1490, 726), (1292, 726)], label='não', lpos=(1400, 716))
    ini(1200, 726, 'Oferta concluída')
    s.add(f"<path d='M30 750' />")
    s.save(path)


if __name__ == '__main__':
    arquitetura('arquitetura.svg')
    modelo('modelo-dados.svg')
    fluxo('fluxo-uso.svg')
    print('ok')
