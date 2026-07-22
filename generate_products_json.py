import json
import os
import re

public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
json_path = os.path.join(public_dir, "products.json")
pages_dir = os.path.join(public_dir, "pages")

print("Iniciando parser estruturado de produtos em Duas Colunas (Coordenadas X, Y)...")

all_products = []
product_id_counter = 1

def clean_product_name(name):
    name = re.sub(r'^\d+([.,]\d+)?\s*', '', name)
    name = re.sub(r'\s*\([Cc0-9IiDd]+\)\s*$', '', name)
    return name.strip()

def format_price_val(val, is_pmc, pf_val=None):
    if not val:
        return ""
    clean = val.replace(',', '.')
    try:
        num = float(clean)
    except ValueError:
        return val
        
    if '.' not in val:
        if len(val) == 3:
            if is_pmc and pf_val and pf_val > 10.0:
                num = num / 10.0
            else:
                num = num / 100.0
        else:
            num = num / 100.0
            
    return f"R$ {num:,.2f}".replace('.', 'X').replace(',', '.').replace('X', ',')

# As páginas de preço vão da 12 até a 198
for page_num in range(12, 199):
    words_file = os.path.join(pages_dir, f"page_{page_num}.words.json")
    if not os.path.exists(words_file):
        continue
        
    with open(words_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # Agrupar palavras em duas colunas fixas (X < 53.0 e X >= 53.0)
    cols = {'left': [], 'right': []}
    for w in data:
        if w[0] < 53.0:
            cols['left'].append(w)
        else:
            cols['right'].append(w)
            
    section = "Lista A-Z" # Padrão
    
    # Processar cada coluna individualmente para evitar mesclagem horizontal
    for col_name, words in cols.items():
        # Agrupar por altura Y com precisão de 0.1% para juntar palavras na mesma linha
        lines_by_y = {}
        for w in words:
            y = round(w[1], 1)
            if y not in lines_by_y: lines_by_y[y] = []
            lines_by_y[y].append(w)
            
        current_product = ""
        current_lab = "N/D"
        current_substance = ""
        
        for y in sorted(lines_by_y.keys()):
            # Ordenar palavras da linha da esquerda pra direita
            line_words = sorted(lines_by_y[y], key=lambda x: x[0])
            text = ' '.join([w[4] for w in line_words]).strip()
            if not text: continue
            
            text_upper = text.upper()
            
            # Atualizar Seção caso apareça no topo
            if "CENTRAL DE" in text_upper:
                section = "Central de Preços"
            
            # Identificar linha de apresentação (contém letras minúsculas ou números de formatação)
            # Na ABCFarma, apresentações contêm 'mg', 'ml', 'cx', 'comp', ou números com '...'
            if re.search(r'[a-z0-9]', text):
                # Tentar extrair preços (2 decimais estritos)
                prices = re.findall(r'\d+[.,]\d{2}', text)
                if len(prices) >= 2:
                    # É uma apresentação válida com preços!
                    pf_raw = prices[-2]
                    pmc_raw = prices[-1]
                    
                    # Extrair o nome da apresentação (antes do primeiro preço encontrado)
                    pres_match = re.split(r'\d+[.,]\d{2}', text)
                    presentation = pres_match[0].strip()
                    presentation = re.sub(r'(\.{2,}|\s+)$', '', presentation).strip()
                    if not presentation:
                        presentation = "Unidade Padrão"
                    
                    try:
                        pf_float = float(pf_raw.replace(',', '.'))
                        if '.' not in pf_raw: pf_float = pf_float / 100.0
                    except:
                        pf_float = 0.0
                        
                    # Extract inline product name if present at the end of the line
                    inline_name_raw = pres_match[-1].strip()
                    inline_name = re.sub(r'^[\d\s]+', '', inline_name_raw).strip()
                    if len(inline_name) >= 3 and inline_name.upper() == inline_name:
                        current_product = inline_name
                        current_lab = inline_name
                        current_substance = inline_name

                    if current_product:
                        all_products.append({
                            "id": f"prod_{product_id_counter}",
                            "name": current_product,
                            "substance": clean_product_name(current_substance) or current_product,
                            "lab": current_lab.upper(),
                            "presentation": presentation,
                            "pf20": format_price_val(pf_raw, False),
                            "pmc20": format_price_val(pmc_raw, True, pf_float),
                            "page": page_num,
                            "section": section
                        })
                        product_id_counter += 1
                        
            # Se for tudo maiúsculo e tem mais de 3 letras, provavelmente é o nome de um produto ou lab
            elif text_upper == text and len(text) > 3:
                # Pular linhas de ruído ou títulos genéricos
                if re.match(r'^\d+[\s\d%.,]*$', text) or "PRODUTO" in text or "PMC" in text:
                    continue
                    
                cleaned_text = clean_product_name(text)
                
                # Regra heurística: nomes curtos podem ser laboratórios, nomes longos são substâncias
                # mas o primeiro uppercase que encontramos geralmente é o Produto.
                if len(cleaned_text) < 15 and "(GEN)" not in cleaned_text:
                    current_lab = cleaned_text
                current_product = cleaned_text

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(all_products, f, ensure_ascii=False, indent=2)

print(f"Sucesso Total! A nova inteligência estruturou {len(all_products)} produtos (Motor OCR de Duas Colunas) salvos em {json_path}")
