import json
import os
import re

public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
json_path = os.path.join(public_dir, "products.json")
pages_dir = os.path.join(public_dir, "pages")

# OCR real (Tesseract) sobre a imagem renderizada de cada pagina, usado como
# fonte primaria do texto de nome/laboratorio/substancia -- nao dos precos.
#
# O que este script chamava de "OCR" ate aqui era, na verdade, o texto
# embutido no PDF (PyMuPDF), nao reconhecimento de imagem. Para varios
# produtos esse texto embutido vem com caracteres trocados por causa de um
# problema de codificacao de fonte no PDF original (ex: o produto "ATENTAH"
# saia como "ATENTAN" -- confirmado comparando com a pagina impressa). Testei
# rodar OCR de verdade na imagem renderizada e ele le esses nomes
# corretamente, porque a imagem mostra o glifo real, sem depender do mapa de
# caracteres corrompido do PDF. Já nas colunas de preco (numeros muito densos,
# colados um no outro) o OCR nao ajuda -- testado e confirmado que erra tanto
# quanto o texto extraido do PDF -- entao os precos continuam vindo só da
# extracao por coordenadas.
#
# Requer `pip install pillow pytesseract` e o binario `tesseract` instalado
# (`apt install tesseract-ocr tesseract-ocr-por` no Linux). Se algo disso
# faltar, o script funciona do mesmo jeito, só sem essa melhoria de nomes.
try:
    from PIL import Image
    import pytesseract
    from pytesseract import Output
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

print("Iniciando parser estruturado de produtos (motor com deteccao de tabela por coordenadas)...")
if not OCR_AVAILABLE:
    print("Aviso: PIL/pytesseract nao encontrados -- rodando sem a melhoria de OCR nos nomes.")
    print("Para ativar: pip install pillow pytesseract  (e instalar o binario tesseract-ocr + tesseract-ocr-por)")

# --- Constantes de geometria da tabela --------------------------------------
# As paginas de preco sao impressas em duas "meias-tabelas" (colunas) lado a
# lado. O ponto de corte entre elas varia um pouco de pagina a pagina, entao
# ele e detectado dinamicamente (ver find_column_split) em vez de um valor
# fixo. 44.5 e usado apenas como fallback para paginas sem uma quebra clara
# (ex: capa, orientacoes).
DEFAULT_COL_SPLIT = 44.5
COL_GAP_SEARCH_RANGE = (36.0, 52.0)
MIN_COL_GAP = 0.8

# Linhas que fisicamente pertencem a mesma "linha logica" da tabela (mesmo
# produto/preco) aparecem no PDF com pequenas variacoes de baseline (~0.1-0.4%
# da altura da pagina). Linhas de produtos diferentes ficam bem mais afastadas
# (~0.7% ou mais). Esse valor foi calibrado observando a distribuicao real de
# gaps verticais nas paginas de preco ja extraidas.
ROW_CLUSTER_GAP = 0.6

# Dentro de cada meia-coluna, o texto da apresentacao (dosagem/forma/qtd) fica
# a esquerda e a zona de precos (PF/PMC de cada faixa) fica mais a direita.
PRICE_ZONE_MARGIN = 3.0

# Tolerancia de "mesma linha visual" ao ordenar por Y: palavras que
# deveriam estar na mesma linha as vezes tem uma diferenca de sub-pixel no
# Y (ex: 15.90 vs 15.94) por causa de fonte/peso diferentes -- bem menor
# do que a diferenca real entre duas sub-linhas distintas (ROW_CLUSTER_GAP).
ROW_Y_JITTER = 0.15

# O laboratorio (quando impresso) fica bem afastado do nome/codigo do
# produto na mesma linha -- maior do que qualquer espaco entre palavras de
# uma mesma frase. Um limiar fixo de posicao X nao funciona porque a
# indentacao da "meia-coluna" varia de pagina a pagina; em vez disso,
# procuramos o maior espaco horizontal dentro da propria linha.
NAME_LAB_GAP_THRESHOLD = 10.0

# Substituicoes de caracteres corrompidos pela extracao de texto do PDF
# (glifos de fontes customizadas decodificados incorretamente).
OCR_CHAR_FIXES = [
    ('€', 'C'),
    ('«', 'x'),
]

# Idioma usado pelo OCR real (Tesseract) para nome/laboratorio/substancia.
OCR_LANG = "por"

PRICE_DECIMAL_RE = re.compile(r'^\d+,\d{1,2}$')
PRICE_BARE_RE = re.compile(r'^\d{2,6}\]?$')
NOISE_LINE_RE = re.compile(r'^\d+[\s\d%.,]*$')

# Tokens que compoem as linhas de legenda/cabecalho repetidas no topo de
# cada pagina de precos (lista de siglas de estado por faixa de desconto e
# os percentuais de cada faixa), para nao serem confundidas com uma linha
# de nome/laboratorio de produto.
LEGEND_TOKEN_RE = re.compile(r'^([A-Z]{2,4},?|\(\d+\)|\d{1,3}(?:,\d+)?%(?:\(\d+\))?|—)$')

all_products = []
product_id_counter = 1


def fix_ocr_chars(text):
    for bad, good in OCR_CHAR_FIXES:
        text = text.replace(bad, good)
    return text


def clean_product_name(name):
    # Remove TODOS os tokens numericos soltos no inicio (as vezes mais de
    # um numero de referencia/preco fica grudado antes do nome de verdade).
    name = re.sub(r'^(\d+([.,]\d+)?\s+)+', '', name)
    name = re.sub(r'\s*\([Cc0-9IiDd]+\)\s*$', '', name)
    return name.strip()


def format_price_val(raw):
    """Converte um token numerico bruto (com ou sem separador decimal) em
    uma string monetaria formatada. Quando a virgula decimal esta ausente
    (falha conhecida da extracao de texto para certas fontes), assume-se
    2 casas decimais implicitas."""
    if not raw:
        return ""
    raw = raw.rstrip(']')
    clean = raw.replace(',', '.')
    try:
        num = float(clean)
    except ValueError:
        return ""
    if ',' not in raw:
        num = num / 100.0
    return f"R$ {num:,.2f}".replace('.', 'X').replace(',', '.').replace('X', ',')


def find_column_split(words):
    """Detecta o ponto de corte entre as duas meias-tabelas de uma pagina.

    Toda pagina de precos repete o cabecalho da coluna duas vezes -- uma
    para a coluna esquerda, outra para a direita -- e cada uma comeca com
    a palavra "Produto" (a da direita costuma vir colada ao caractere
    separador da tabela, ex: "||Produto"). Essa posicao e um sinal direto
    e muito mais confiavel do que tentar adivinhar por "maior espaco vazio
    horizontal": a posicao real da quebra varia bastante de pagina a
    pagina (de x=37 a x=55 nas paginas verificadas), entao um intervalo de
    busca fixo para o gap deixava passar despercebidas paginas inteiras
    com a quebra fora do intervalo esperado -- foi o caso, por exemplo, de
    produtos como o ATENTAH (atomoxetina) na pagina 27, que ficaram de
    fora do extrato final por causa disso.
    """
    produto_tokens = sorted((w[0] for w in words if 'Produto' in w[4]))
    if len(produto_tokens) >= 2:
        return produto_tokens[1] - 0.5

    # Fallback por espaco horizontal vazio, para paginas sem o cabecalho
    # repetido (ex: capa, orientacoes, paginas de rosto de secao).
    xs = sorted({round(w[0], 2) for w in words if COL_GAP_SEARCH_RANGE[0] <= w[0] <= COL_GAP_SEARCH_RANGE[1]})
    if len(xs) < 2:
        return DEFAULT_COL_SPLIT

    candidates = []
    for i in range(1, len(xs)):
        gap = xs[i] - xs[i - 1]
        if gap >= MIN_COL_GAP:
            candidates.append((xs[i] + xs[i - 1]) / 2)

    if not candidates:
        return DEFAULT_COL_SPLIT

    return min(candidates, key=lambda mid: abs(mid - DEFAULT_COL_SPLIT))


def cluster_rows(words):
    """Agrupa palavras em linhas logicas por proximidade vertical, unindo
    sub-linhas (baseline levemente deslocada) que pertencem a mesma linha
    real da tabela."""
    ordered = sorted(words, key=lambda w: w[1])
    rows = []
    current = []
    last_y = None
    for w in ordered:
        y = w[1]
        if last_y is not None and (y - last_y) > ROW_CLUSTER_GAP:
            rows.append(current)
            current = []
        current.append(w)
        last_y = y
    if current:
        rows.append(current)
    return [sorted(r, key=lambda w: w[0]) for r in rows]


HEADER_ROW_MAX_Y = 11.0


def detect_price_anchors(rows, col_start):
    """Varre as linhas de cabecalho da coluna (marcadas por tokens PF/PMC,
    incluindo variantes com falha de OCR PE/PM) e retorna a lista ordenada
    de posicoes X (relativas ao inicio da coluna) de cada par PF/PMC.

    O filtro usa a posicao vertical (perto do topo da pagina), nao um
    limite fixo de posicao horizontal: a largura da coluna varia de
    pagina a pagina (ja vimos colunas com a ultima ancora de preco alem
    de x=50), entao um teto fixo de X para "o que conta como cabecalho"
    descartava ancoras legitimas de faixas de desconto mais altas (tier 4
    e 5) em paginas com coluna mais larga.
    """
    pf_anchors = []
    pmc_anchors = []
    for row in rows:
        for w in row:
            if w[1] > HEADER_ROW_MAX_Y:
                continue
            token = w[4]
            rel_x = w[0] - col_start
            if rel_x < 0:
                continue
            if token in ('PF', 'PE'):
                pf_anchors.append(rel_x)
            elif token in ('PMC', 'PM'):
                pmc_anchors.append(rel_x)
    pf_anchors.sort()
    pmc_anchors.sort()
    return pf_anchors, pmc_anchors


def split_name_lab(words):
    """Separa uma linha de nome/produto em (nome, laboratorio) procurando o
    maior espaco horizontal entre palavras consecutivas. So considera que ha
    um laboratorio separado se esse espaco for bem maior do que o espaco
    normal entre palavras de uma mesma frase.

    Alem das duas listas de palavras, retorna tambem a posicao X do corte
    (ou None se nao houve corte) -- usado para delimitar a zona de nome vs.
    a zona de laboratorio ao consultar o indice de OCR."""
    if len(words) <= 1:
        return [t for _, t in words], [], None

    best_gap = 0.0
    split_at = None
    for i in range(1, len(words)):
        gap = words[i][0] - words[i - 1][0]
        if gap > best_gap:
            best_gap = gap
            split_at = i

    if best_gap < NAME_LAB_GAP_THRESHOLD:
        return [t for _, t in words], [], None

    split_x = (words[split_at - 1][0] + words[split_at][0]) / 2
    return [t for _, t in words[:split_at]], [t for _, t in words[split_at:]], split_x


# Uma primeira versao disto rodava o OCR uma unica vez por meia-coluna
# inteira (rapido, ~3s) e depois cruzava as palavras reconhecidas com cada
# linha pela posicao (x, y). Na pratica isso nao foi confiavel: o Tesseract
# quebra as linhas de um jeito que nem sempre bate com o agrupamento de
# linhas feito a partir das coordenadas do PDF, e a tentativa de "achar a
# janela de Y certa" ou vazava numeros de uma linha vizinha para dentro do
# nome (janela larga demais) ou perdia palavras isoladas no meio da coluna
# (rodando com um modo de pagina mais rapido). Recortar e rodar OCR so na
# regiao exata de CADA linha de nome/laboratorio -- mais chamadas ao
# Tesseract, mas cada uma sobre uma imagem pequena e isolada -- foi o que
# realmente reproduziu a leitura correta (ex: "ATENTAH") de forma
# consistente.
OCR_MARGIN_PCT = 0.15

# Um recorte apertado de uma unica linha, quando a linha de cima esta bem
# proxima (comum nesta tabela), quase sempre pega uma sobra borrada da linha
# anterior -- o Tesseract le esse borrao como uma "palavra" curta e de baixa
# confianca (ex: "os", "tt", "Ma", geralmente <=3 caracteres e conf < 60),
# bem diferente do texto real (nomes/codigos/labs, quase sempre 4+
# caracteres OU lidos com confianca alta). Descartar so os tokens que batem
# nesse perfil (curto E baixa confianca) filtra essa sobra sem arriscar
# cortar texto de verdade -- testado contra tentativas de "aparar" um
# pedaco fixo do topo do recorte, que ora deixava passar a sobra, ora
# cortava letras reais (a proporcao de sobra varia de linha a linha).
OCR_MIN_TOKEN_LEN = 4
OCR_MIN_CONF_FOR_SHORT_TOKEN = 60


def ocr_crop_region(image, page_w, page_h, x_min_pct, y_min_pct, x_max_pct, y_max_pct):
    """Recorta uma regiao da pagina (em percentual) e roda o Tesseract nela,
    devolvendo o texto reconhecido (descartando fragmentos curtos e de baixa
    confianca, tipicos de sobra da linha vizinha -- ver comentario acima)."""
    if not OCR_AVAILABLE:
        return ""

    left = max(0, int((x_min_pct - OCR_MARGIN_PCT) / 100 * page_w))
    right = min(page_w, int((x_max_pct + OCR_MARGIN_PCT) / 100 * page_w))
    top = max(0, int((y_min_pct - OCR_MARGIN_PCT) / 100 * page_h))
    bottom = min(page_h, int((y_max_pct + OCR_MARGIN_PCT) / 100 * page_h))

    if right <= left or bottom <= top:
        return ""

    try:
        crop = image.crop((left, top, right, bottom))
        data = pytesseract.image_to_data(crop, lang=OCR_LANG, config="--psm 6", output_type=Output.DICT)
    except Exception:
        # Uma falha isolada de OCR num recorte nao deve derrubar a pagina
        # inteira -- so faz essa linha cair de volta pro texto do PyMuPDF.
        return ""

    tokens = []
    for i in range(len(data['text'])):
        token = data['text'][i].strip()
        if not token:
            continue
        conf = data['conf'][i]
        if len(token) < OCR_MIN_TOKEN_LEN and conf < OCR_MIN_CONF_FOR_SHORT_TOKEN:
            continue
        tokens.append((data['left'][i], token))

    tokens.sort(key=lambda t: t[0])
    return ' '.join(t for _, t in tokens).strip()


def nearest_anchor_index(rel_x, anchors, max_dist=3.0):
    best_i, best_d = None, max_dist
    for i, a in enumerate(anchors):
        d = abs(rel_x - a)
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def price_slot_for_token(rel_x, token, pf_anchors, pmc_anchors):
    """Identifica a qual faixa de desconto (tier) e coluna (PF ou PMC) um
    token numerico pertence, com base na ancora de cabecalho mais proxima.
    Retorna None se o token nao parece um preco ou nao ha ancora perto o
    suficiente."""
    if not (PRICE_DECIMAL_RE.match(token) or PRICE_BARE_RE.match(token)):
        return None
    pf_i = nearest_anchor_index(rel_x, pf_anchors)
    pmc_i = nearest_anchor_index(rel_x, pmc_anchors)
    if pf_i is not None and (pmc_i is None or abs(rel_x - pf_anchors[pf_i]) <= abs(rel_x - pmc_anchors[pmc_i])):
        return ('pf', pf_i)
    if pmc_i is not None:
        return ('pmc', pmc_i)
    return None


def split_by_price_collision(words, col_start, pf_anchors, pmc_anchors, price_zone_start):
    """Divide uma linha logica (ja agrupada por proximidade vertical) em
    varias, caso ela contenha DOIS valores para a MESMA faixa de desconto
    -- o que so acontece quando duas apresentacoes/precos diferentes foram
    fundidos por engano em uma unica linha.

    Isso resolve um problema que o agrupamento por proximidade vertical
    sozinho nao consegue: em secoes do documento com entrelinhamento mais
    apertado, o espaco vertical entre o final de uma linha de preco e o
    inicio da proxima pode ser menor do que o espaco entre as
    "sub-linhas" (numero/texto) de uma UNICA linha, entao nenhum limiar
    fixo de distancia separa os dois casos corretamente. Como cada faixa
    de desconto so pode aparecer uma vez por produto/apresentacao, usar
    a colisao de faixa como sinal de corte e muito mais confiavel do que
    tentar adivinhar pela distancia vertical.

    A ordenacao usa o Y "agrupado" (arredondado por ROW_Y_JITTER) em vez
    do Y bruto: palavras da MESMA linha visual as vezes tem Y com uma
    diferenca de sub-pixel (ex: 15.90 vs 15.94) por causa de fonte/peso
    diferentes, e isso e bem menor do que a diferenca real entre
    sub-linhas distintas (~0.27+). Ordenar pelo Y bruto podia inverter a
    ordem esquerda-direita dentro de uma unica linha (nome vindo depois
    do laboratorio, por exemplo) so por causa desse jitter.
    """
    def sort_key(w):
        return (round(w[1] / ROW_Y_JITTER), w[0])

    ordered = sorted(words, key=sort_key)
    result_rows = []
    current = []
    filled_slots = set()

    for w in ordered:
        rel_x = w[0] - col_start
        slot = None
        if rel_x >= price_zone_start:
            slot = price_slot_for_token(rel_x, w[4], pf_anchors, pmc_anchors)

        if slot is not None:
            if slot in filled_slots:
                if current:
                    result_rows.append(current)
                current = []
                filled_slots = set()
            filled_slots.add(slot)

        current.append(w)

    if current:
        result_rows.append(current)

    # A saida e reordenada por X puro (nao pelo Y agrupado usado acima): o
    # agrupamento por Y ajuda a detectar colisao na ordem certa, mas usa-lo
    # tambem na ordem final agrupa demais em paginas com mais sub-linhas,
    # piorando a separacao nome/laboratorio (testado: quase triplicou a taxa
    # de laboratorio nao encontrado). Ordenar por X puro deixa raramente
    # 2 sub-linhas com o mesmo X inicial fora de ordem entre si (cosmetico,
    # ex: texto de apresentacao com palavras fora de ordem) mas preserva a
    # separacao correta de nome/laboratorio na maioria dos casos, que
    # importa mais.
    return [sorted(r, key=lambda w: w[0]) for r in result_rows]


def process_column(rows, col_start, image=None, page_w=None, page_h=None):
    global product_id_counter

    pf_anchors, pmc_anchors = detect_price_anchors(rows, col_start)
    if pf_anchors:
        price_zone_start = min(pf_anchors[0], pmc_anchors[0] if pmc_anchors else pf_anchors[0]) - PRICE_ZONE_MARGIN
    else:
        price_zone_start = 15.0

    split_rows = []
    for row in rows:
        split_rows.extend(split_by_price_collision(row, col_start, pf_anchors, pmc_anchors, price_zone_start))
    rows = split_rows

    current_name = None
    current_lab = "N/D"
    current_substance = None
    expect_name = True
    expect_substance = False

    for row in rows:
        words = [(w[0], fix_ocr_chars(w[4])) for w in row]
        joined = ' '.join(t for _, t in words)
        if not joined.strip():
            continue

        # Uma linha de apresentacao/preco sempre contem uma letra minuscula
        # (mg, comp, cx...) ou um preco decimal. Digitos isolados nao bastam,
        # pois codigos de classificacao como "(C1)"/"(B1)" tambem contem
        # digitos mas pertencem a linha de nome/laboratorio.
        is_presentation_row = bool(re.search(r'[a-z]', joined)) or bool(re.search(r'\d+,\d{2}', joined))

        if not is_presentation_row:
            text_upper = joined.upper()
            if (
                NOISE_LINE_RE.match(joined)
                or 'PRODUTO' in text_upper
                or 'PMC' in text_upper
                or 'IMPORTANTE' in text_upper
                or joined in ('PF', 'PE', 'PMC', 'PM')
            ):
                continue

            has_legend_marker = any(
                t == '—' or re.match(r'^\d{1,3}(,\d+)?%', t) or re.match(r'^\(\d+\)$', t)
                for _, t in words
            )
            if has_legend_marker and all(LEGEND_TOKEN_RE.match(t) for _, t in words):
                continue

            # Uma linha de nome/laboratorio de verdade sempre comeca perto da
            # margem esquerda da coluna (zona de texto). Se TODAS as palavras
            # da linha estiverem dentro da zona de precos, isso nao e um nome
            # -- e sobra de uma linha de preco corrompida (numeros com letras
            # coladas por falha da extracao, ex: "N731", "NM") que nao bateu
            # com o regex de preco valido. Tratar isso como nome contaminaria
            # o produto seguinte com lixo; melhor ignorar a linha.
            if all((x - col_start) >= price_zone_start for x, _ in words):
                continue

            name_words, lab_words, split_x = split_name_lab(words)

            # Zona (Y e X) desta linha em percentual de pagina, para recortar
            # a imagem e rodar o OCR -- o `words` local ja perdeu o Y ao ser
            # montado logo acima, entao usamos `row`, a tupla original.
            row_y_min = min(w[1] for w in row)
            row_y_max = max(w[3] for w in row)
            row_x_min = min(w[0] for w in row)
            row_x_max = max(w[2] for w in row)
            can_ocr = image is not None and page_w and page_h

            if expect_name:
                name_zone_end = split_x if split_x is not None else row_x_max
                ocr_name = ocr_crop_region(image, page_w, page_h, row_x_min, row_y_min, name_zone_end, row_y_max) if can_ocr else ""
                fallback_name = ' '.join(name_words) if name_words else joined
                current_name = clean_product_name(ocr_name or fallback_name)

                if split_x is not None:
                    ocr_lab = ocr_crop_region(image, page_w, page_h, split_x, row_y_min, row_x_max, row_y_max) if can_ocr else ""
                    fallback_lab = ocr_lab or ' '.join(lab_words)
                    current_lab = fallback_lab.upper() if fallback_lab else "N/D"
                else:
                    current_lab = "N/D"
                current_substance = None
                expect_name = False
                expect_substance = True
            elif expect_substance:
                ocr_substance = ocr_crop_region(image, page_w, page_h, row_x_min, row_y_min, row_x_max, row_y_max) if can_ocr else ""
                current_substance = clean_product_name(ocr_substance or joined)
                if lab_words and current_lab == "N/D":
                    current_lab = ' '.join(lab_words).upper()
                expect_substance = False
            else:
                # Continuacao de um nome/substancia que quebrou em mais de uma linha
                ocr_continuation = ocr_crop_region(image, page_w, page_h, row_x_min, row_y_min, row_x_max, row_y_max) if can_ocr else ""
                continuation_text = clean_product_name(ocr_continuation or joined)
                if current_substance:
                    current_substance = f"{current_substance} {continuation_text}".strip()
                else:
                    current_substance = continuation_text
            continue

        # Linha de apresentacao/precos. Uma linha deste tipo sempre marca o
        # fim do bloco nome/laboratorio/substancia atual -- a proxima linha
        # de nome encontrada deve iniciar um NOVO produto, mesmo que esta
        # linha em particular nao contenha precos aproveitaveis (ex: numeros
        # colados sem separador por falha da extracao de texto do PDF).
        # Resetar aqui evita que uma linha de preco ilegivel "vaze" nomes de
        # produtos diferentes para dentro da mesma substancia.
        expect_name = True

        if current_name is None:
            continue

        presentation_tokens = [t for x, t in words if (x - col_start) < price_zone_start]
        price_tokens = [(x - col_start, t) for x, t in words if (x - col_start) >= price_zone_start]

        presentation = ' '.join(presentation_tokens).strip()
        presentation = re.sub(r'\.{2,}', '', presentation)
        presentation = re.sub(r'\s+', ' ', presentation).strip(' .')
        if not presentation:
            presentation = "Unidade Padrao"

        tiers = {}
        for rel_x, token in price_tokens:
            if PRICE_DECIMAL_RE.match(token) or PRICE_BARE_RE.match(token):
                pf_i = nearest_anchor_index(rel_x, pf_anchors)
                pmc_i = nearest_anchor_index(rel_x, pmc_anchors)
                if pf_i is not None and (pmc_i is None or abs(rel_x - pf_anchors[pf_i]) <= abs(rel_x - pmc_anchors[pmc_i])):
                    tiers.setdefault(pf_i, {})['pf'] = token
                elif pmc_i is not None:
                    tiers.setdefault(pmc_i, {})['pmc'] = token

        if not tiers:
            # Nenhum preco reconhecido nesta linha -- nao ha o suficiente
            # para formar um registro de produto valido.
            continue

        tier0 = tiers.get(0, {})
        pf20 = format_price_val(tier0.get('pf', ''))
        pmc20 = format_price_val(tier0.get('pmc', ''))

        pricing_tiers = []
        for idx in sorted(tiers.keys()):
            t = tiers[idx]
            pricing_tiers.append({
                "tier": idx + 1,
                "pf": format_price_val(t.get('pf', '')),
                "pmc": format_price_val(t.get('pmc', ''))
            })

        all_products.append({
            "id": f"prod_{product_id_counter}",
            "name": current_name or current_substance or "N/D",
            "substance": current_substance or current_name or "N/D",
            "lab": current_lab.upper(),
            "presentation": presentation,
            "pf20": pf20,
            "pmc20": pmc20,
            "pricingTiers": pricing_tiers,
            "page": None,  # preenchido pelo chamador
            "section": None,  # preenchido pelo chamador
        })
        product_id_counter += 1


def process_page(words, page_num, section, image_path):
    col_split = find_column_split(words)
    left_words = [w for w in words if w[0] < col_split]
    right_words = [w for w in words if w[0] >= col_split]

    start_index = len(all_products)

    image = None
    page_w = page_h = None
    if OCR_AVAILABLE and image_path and os.path.exists(image_path):
        try:
            image = Image.open(image_path)
            page_w, page_h = image.size
        except Exception as exc:
            print(f"Aviso: nao foi possivel abrir a imagem da pagina {page_num} para OCR: {exc}")
            image = None

    try:
        process_column(cluster_rows(left_words), col_start=0.0, image=image, page_w=page_w, page_h=page_h)
        process_column(cluster_rows(right_words), col_start=col_split, image=image, page_w=page_w, page_h=page_h)
    finally:
        if image is not None:
            image.close()

    for product in all_products[start_index:]:
        product["page"] = page_num
        product["section"] = section


# As paginas de preco vao da 12 ate a 198
section = "Lista A-Z"
total_pages = sum(1 for p in range(12, 199) if os.path.exists(os.path.join(pages_dir, f"page_{p}.words.json")))
pages_done = 0
for page_num in range(12, 199):
    words_file = os.path.join(pages_dir, f"page_{page_num}.words.json")
    if not os.path.exists(words_file):
        continue

    with open(words_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    page_text_upper = ' '.join(w[4] for w in data).upper()
    if "CENTRAL DE" in page_text_upper:
        section = "Central de Precos"

    image_path = os.path.join(pages_dir, f"page_{page_num}.jpg")
    process_page(data, page_num, section, image_path)

    pages_done += 1
    if OCR_AVAILABLE and pages_done % 20 == 0:
        print(f"OCR: {pages_done}/{total_pages} paginas processadas...")

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(all_products, f, ensure_ascii=False, indent=2)

print(f"Sucesso! {len(all_products)} produtos estruturados (deteccao de tabela por coordenadas) salvos em {json_path}")
