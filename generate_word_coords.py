import fitz
import json
import os
import time

pdf_path = "c:/Users/isaac/Downloads/ABCFarma/Revs.pdf"
public_dir = "c:/Users/isaac/Downloads/ABCFarma/public"
pages_dir = os.path.join(public_dir, "pages")

os.makedirs(pages_dir, exist_ok=True)

print("Iniciando extração de coordenadas de palavras...")
start_time = time.time()
doc = fitz.open(pdf_path)

for i in range(len(doc)):
    page_num = i + 1
    page = doc[i]
    width = page.rect.width
    height = page.rect.height
    
    # get words
    words = page.get_text("words")
    # format: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
    
    word_list = []
    for w in words:
        # Normalize to percent of page width and height
        x0 = round((w[0] / width) * 100, 2)
        y0 = round((w[1] / height) * 100, 2)
        x1 = round((w[2] / width) * 100, 2)
        y1 = round((w[3] / height) * 100, 2)
        word_list.append([x0, y0, x1, y1, w[4]])
        
    out_path = os.path.join(pages_dir, f"page_{page_num}.words.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(word_list, f, ensure_ascii=False)
        
    if page_num % 50 == 0 or page_num == len(doc):
        print(f"Coordenadas de {page_num}/{len(doc)} páginas salvas em {time.time() - start_time:.2f}s...")

print("Concluído!")
