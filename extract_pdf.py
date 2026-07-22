import fitz
import json
import time
import os
import re

pdf_path = "c:/Users/isaac/Downloads/ABCFarma/Revs.pdf"
public_dir = "c:/Users/isaac/Downloads/ABCFarma/public"
pages_dir = os.path.join(public_dir, "pages")

os.makedirs(pages_dir, exist_ok=True)

print("Iniciando extração do PDF...")
start_time = time.time()
doc = fitz.open(pdf_path)

pages_data = []

def detect_section(page_num, text):
    text_upper = text.upper()
    if page_num <= 4:
        return "Capa / Editorial"
    if "CENTRAL DE PREÇOS" in text_upper or "CENTRAL DE ATUALIZAÇÕES" in text_upper:
        return "Central de Preços"
    if "ORIENTAÇÕES LISTA DE PREÇOS" in text_upper or "ORIENTAÇÕES AO CONSUMIDOR" in text_upper:
        return "Orientações"
    
    # Try finding 3-letter header code like "ART", "CLO", "DRO", "HEZ", "VIG"
    match = re.search(r'\b([A-Z]{3})\b', text[:150])
    if match:
        first_letter = match.group(1)[0]
        return f"Lista A-Z ({first_letter})"
    
    return "Lista de Preços"

for i in range(len(doc)):
    page_num = i + 1
    page = doc[i]
    raw_text = page.get_text()
    
    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
    cleaned_text = " ".join(lines)
    
    section = detect_section(page_num, raw_text)
    
    pages_data.append({
        "id": page_num,
        "page": page_num,
        "section": section,
        "text": cleaned_text,
        "lines": lines[:100],
        "line_count": len(lines),
        "image": f"/pages/page_{page_num}.jpg"
    })
    
    pix = page.get_pixmap(dpi=140)
    pix.save(os.path.join(pages_dir, f"page_{page_num}.jpg"))

    if page_num % 25 == 0 or page_num == len(doc):
        print(f"Processadas {page_num}/{len(doc)} páginas em {time.time() - start_time:.2f}s...")

json_path = os.path.join(public_dir, "pdf_data.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(pages_data, f, ensure_ascii=False, indent=2)

print(f"Concluído com sucesso! {len(pages_data)} páginas salvas em {json_path}")
print(f"Tempo total: {time.time() - start_time:.2f}s")
