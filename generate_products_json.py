import fitz
import json
import os
import re

pdf_path = "c:/Users/isaac/Downloads/ABCFarma/Revs.pdf"
public_dir = "c:/Users/isaac/Downloads/ABCFarma/public"
json_path = os.path.join(public_dir, "products.json")

print("Iniciando parser estruturado de produtos (com correção de limites e agrupamento)...")

doc = fitz.open(pdf_path)

all_products = []
product_id_counter = 1

def clean_ocr_price(p):
    p = re.sub(r'[^\d.,]', '', p).strip()
    return p

def clean_product_name(name):
    # Remove leading price codes from adjacent column flow (e.g. "19,36 ATENTAN" -> "ATENTAN")
    name = re.sub(r'^\d+([.,]\d+)?\s*', '', name)
    # Remove control/scheduling suffixes (e.g. "ATENTAN (C1)" -> "ATENTAN")
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

for i in range(len(doc)):
    page_num = i + 1
    page = doc[i]
    
    # Skip non-price guide pages
    if page_num < 12 or page_num > 198:
        continue
        
    text_upper = page.get_text().upper()
    section = "Lista de Preços"
    if "CENTRAL DE PREÇOS" in text_upper or "CENTRAL DE ATUALIZAÇÕES" in text_upper:
        section = "Central de Preços"
    elif "ORIENTAÇÕES LISTA DE PREÇOS" in text_upper or "ORIENTAÇÕES AO CONSUMIDOR" in text_upper:
        section = "Orientações"
    else:
        # Find letter code
        match = re.search(r'\b([A-Z]{3})\b', text_upper[:150])
        if match:
            section = f"Lista A-Z ({match.group(1)[0]})"
            
    lines = [line.strip() for line in page.get_text().split('\n') if line.strip()]
    
    current_product = ""
    current_substance = ""
    current_lab = ""
    has_parsed_presentation = False
    
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        
        # Check if presentation
        if '...' in line or line.endswith('.'):
            parts = re.split(r'\.{2,}', line)
            presentation = parts[0].strip()
            
            prices = []
            if len(parts) > 1 and parts[1].strip():
                # Strict 2-decimal price extraction to prevent horizontal column bleeding
                prices = re.findall(r'\d+[.,]\d{2}', parts[1])
                
            if not prices:
                j = idx + 1
                while j < len(lines):
                    next_line = lines[j]
                    
                    # Stop if it contains text words, indicating we hit a new product description line
                    if re.search(r'[A-Za-z]{2,}', next_line):
                        break
                        
                    # Look ahead strictly for 2-decimal prices if missing
                    found_prices = re.findall(r'\d+[.,]\d{2}', next_line)
                    if found_prices:
                        prices.extend(found_prices)
                        j += 1
                    else:
                        break
            else:
                j = idx + 1
                
            if len(prices) >= 2:
                pf_raw = prices[0]
                pmc_raw = prices[1]
                
                try:
                    pf_float = float(pf_raw.replace(',', '.'))
                    if '.' not in pf_raw:
                        pf_float = pf_float / 100.0
                except ValueError:
                    pf_float = 0.0
                    
                pf_formatted = format_price_val(pf_raw, False)
                pmc_formatted = format_price_val(pmc_raw, True, pf_float)
                
                prod_name = clean_product_name(current_product) or "PRODUTO SEM NOME"
                
                # Make sure name is cleaned and uppercase
                prod_name = prod_name.upper()
                
                all_products.append({
                    "id": f"prod_{product_id_counter}",
                    "name": prod_name,
                    "substance": clean_product_name(current_substance).upper(),
                    "lab": current_lab.upper() or "OUTROS",
                    "presentation": presentation,
                    "pf20": pf_formatted,
                    "pmc20": pmc_formatted,
                    "page": page_num,
                    "section": section
                })
                product_id_counter += 1
                has_parsed_presentation = True
                idx = j
                continue
                
        # Potential title line
        if line.isupper() and len(line) > 2 and '...' not in line:
            # Skip purely numeric or price sequences
            if re.match(r'^\d+[\s\d%.,]*$', line):
                idx += 1
                continue
            # Must have at least 3 letters
            if len(re.findall(r'[A-Z]', line)) < 3:
                idx += 1
                continue
                
            cleaned_title = clean_product_name(line)
            
            if has_parsed_presentation:
                # We already parsed a presentation, so this starts a new product brand!
                current_product = line
                current_substance = ""
                current_lab = ""
                has_parsed_presentation = False
            else:
                # Still building description details for current product
                if not current_product:
                    current_product = line
                else:
                    if len(cleaned_title) < 15:
                        current_lab = cleaned_title
                    else:
                        current_substance = cleaned_title
                        
        idx += 1

# Write output JSON
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(all_products, f, ensure_ascii=False, indent=2)

print(f"Sucesso! {len(all_products)} produtos estruturados extraídos e salvos em {json_path}")
