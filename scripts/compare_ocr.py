import json
import os
import re

def normalize_key(item):
    name = re.sub(r'[^\w]', '', item.get('name', '').lower())
    pres = re.sub(r'[^\w]', '', item.get('presentation', '').lower())
    lab = re.sub(r'[^\w]', '', item.get('lab', '').lower())
    page = str(item.get('page', ''))
    return f"{name}_{pres}_{page}"

def run_cross_reference():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, "public")
    old_json_path = os.path.join(public_dir, "products.json")
    new_json_path = os.path.join(public_dir, "products_novo.json")
    
    if not os.path.exists(old_json_path) or not os.path.exists(new_json_path):
        print("Erro: dataset v1 ou dataset novo não encontrado.")
        return
        
    with open(old_json_path, 'r', encoding='utf-8') as f:
        v1_data = json.load(f)
        
    with open(new_json_path, 'r', encoding='utf-8') as f:
        v2_data = json.load(f)
        
    print(f"Cruzamento de Dados Iniciado:")
    print(f"- Dataset Base (Revs.pdf): {len(v1_data)} produtos")
    print(f"- Dataset Novo (arquivo_novo_ocr.pdf): {len(v2_data)} produtos")
    
    # Store all items mapped by normalized key
    merged_map = {}
    
    # Add all v1 items first
    for item in v1_data:
        key = normalize_key(item)
        merged_map[key] = dict(item)
        
    added_from_v2 = 0
    updated_from_v2 = 0
    
    # Cross reference with v2
    for item in v2_data:
        key = normalize_key(item)
        if key in merged_map:
            existing = merged_map[key]
            # Enrich substance or lab if v2 is cleaner
            if len(item.get('substance', '')) > len(existing.get('substance', '')):
                existing['substance'] = item['substance']
            if existing.get('lab') == 'OUTROS' or existing.get('lab') == 'N/D':
                if item.get('lab') and item.get('lab') != 'N/D':
                    existing['lab'] = item['lab']
            if 'R$' not in existing.get('pmc20', '') and 'R$' in item.get('pmc20', ''):
                existing['pmc20'] = item['pmc20']
            updated_from_v2 += 1
        else:
            merged_map[key] = dict(item)
            added_from_v2 += 1
            
    # Convert map to ordered list and re-index IDs
    final_products = list(merged_map.values())
    for idx, item in enumerate(final_products, start=1):
        item['id'] = f"prod_{idx}"
        
    # Save back into public/products.json
    with open(old_json_path, "w", encoding="utf-8") as f:
        json.dump(final_products, f, ensure_ascii=False, indent=2)
        
    print("\n--- RESUMO DO CRUZAMENTO DE DADOS ---")
    print(f"[OK] Produtos atualizados/enriquecidos: {updated_from_v2}")
    print(f"[OK] Produtos inéditos descobertos e adicionados: {added_from_v2}")
    print(f"[OK] TOTAL CONSOLIDADO NO BANCO DE DADOS: {len(final_products)} produtos")
    print(f"[OK] Arquivo atualizado: {old_json_path}")

if __name__ == "__main__":
    run_cross_reference()
