import json
import os
import re
import difflib

def calculate_quality_score(text):
    if not text:
        return 0
    # Higher score for strings with a high ratio of letters/numbers vs symbols/spaces
    alpha_chars = sum(1 for c in text if c.isalnum())
    return alpha_chars / len(text)

def compare_ocr_datasets(old_json_path, new_json_path, output_path):
    print("Iniciando comparação de OCR entre v1 e v2...")
    
    if not os.path.exists(old_json_path) or not os.path.exists(new_json_path):
        print("Erro: Arquivos JSON não encontrados para comparação.")
        return
        
    with open(old_json_path, 'r', encoding='utf-8') as f:
        old_data = json.load(f)
        
    with open(new_json_path, 'r', encoding='utf-8') as f:
        new_data = json.load(f)
        
    old_dict = {p['id']: p for p in old_data}
    new_dict = {p['id']: p for p in new_data} # Assuming ID generation is deterministic or we match by name
    
    # If IDs might differ, we match by Name + Presentation
    new_name_dict = {f"{p['name']}_{p['presentation']}": p for p in new_data}
    
    merged_data = []
    improved_count = 0
    missing_in_new = 0
    
    for old_p in old_data:
        key = f"{old_p['name']}_{old_p['presentation']}"
        if key in new_name_dict:
            new_p = new_name_dict[key]
            
            # Compare substance quality
            old_sub_score = calculate_quality_score(old_p['substance'])
            new_sub_score = calculate_quality_score(new_p['substance'])
            
            best_substance = new_p['substance'] if new_sub_score > old_sub_score else old_p['substance']
            
            # Use new prices if they exist and are formatted correctly
            pf20 = new_p['pf20'] if 'R$' in new_p['pf20'] else old_p['pf20']
            pmc20 = new_p['pmc20'] if 'R$' in new_p['pmc20'] else old_p['pmc20']
            
            if best_substance != old_p['substance'] or pf20 != old_p['pf20']:
                improved_count += 1
                
            merged_data.append({
                "id": old_p['id'],
                "name": new_p['name'],
                "substance": best_substance,
                "lab": new_p['lab'],
                "presentation": new_p['presentation'],
                "pf20": pf20,
                "pmc20": pmc20,
                "page": new_p['page'],
                "section": new_p['section']
            })
        else:
            missing_in_new += 1
            merged_data.append(old_p)
            
    # Add brand new products found in the new OCR
    old_name_dict = {f"{p['name']}_{p['presentation']}": p for p in old_data}
    added_count = 0
    for new_p in new_data:
        key = f"{new_p['name']}_{new_p['presentation']}"
        if key not in old_name_dict:
            # Generate a new unique ID
            new_p['id'] = f"prod_new_{added_count}"
            merged_data.append(new_p)
            added_count += 1
            
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
        
    print(f"Comparação Concluída!")
    print(f"- Produtos melhorados via novo OCR: {improved_count}")
    print(f"- Produtos mantidos da v1 por falha na v2: {missing_in_new}")
    print(f"- Produtos inéditos descobertos: {added_count}")
    print(f"- Total na base mesclada: {len(merged_data)}")

if __name__ == "__main__":
    # Quando o usuário enviar o novo PDF, nós extrairemos ele para products_new.json
    # e rodaremos este script para gerar o products_merged.json
    print("Script de Diff de OCR pronto. Aguardando novo dataset em public/products_new.json")
