#!/usr/bin/env python3
"""
Exemple de script d'extraction PDF → Template HTML
À adapter selon les bibliothèques utilisées par Nicolas
"""

import pdfplumber
from bs4 import BeautifulSoup
import json
import re
from typing import Dict, List, Tuple

def extract_pdf_to_template(pdf_path: str, account_id: str, template_name: str) -> Dict:
    """
    Extrait le HTML structurel d'un PDF pour créer un template
    
    Args:
        pdf_path: Chemin vers le PDF
        account_id: ID du compte propriétaire
        template_name: Nom du template
    
    Returns:
        Dict avec html_template, css_styles, data_mapping
    """
    
    html_parts = []
    styles = []
    
    # Ouvrir le PDF et extraire le contenu
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # Extraire le texte avec positionnement
            text = page.extract_text()
            
            # Extraire les tableaux
            tables = page.extract_tables()
            
            # Reconstruire le HTML structurel
            page_html = reconstruct_html_from_pdf(text, tables, page, page_num)
            html_parts.append(page_html)
            
            # Extraire les styles (polices, couleurs, etc.)
            page_styles = extract_styles_from_page(page)
            styles.extend(page_styles)
    
    # Combiner toutes les pages
    full_html = '\n'.join(html_parts)
    
    # Identifier les zones de données dynamiques
    template_html = identify_data_zones(full_html)
    
    # Extraire et normaliser les styles CSS
    css_styles = extract_and_normalize_css(styles)
    
    # Créer le mapping de données par défaut
    data_mapping = create_default_data_mapping()
    
    return {
        'html_template': template_html,
        'css_styles': css_styles,
        'data_mapping': data_mapping,
        'metadata': {
            'account_id': account_id,
            'template_name': template_name,
            'source_pdf': pdf_path,
            'pages_count': len(html_parts)
        }
    }


def reconstruct_html_from_pdf(text: str, tables: List, page, page_num: int) -> str:
    """
    Reconstruit le HTML structurel à partir du texte et des tableaux extraits
    """
    soup = BeautifulSoup('', 'html.parser')
    
    # Créer un conteneur pour la page
    page_div = soup.new_tag('div', class_='pv-page')
    page_div['data-page'] = str(page_num)
    
    # Parser le texte en lignes et identifier les structures
    lines = text.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Détecter les titres (majuscules, gras, etc.)
        if is_title(line):
            if current_section:
                page_div.append(current_section)
            current_section = soup.new_tag('section', class_='pv-section')
            title = soup.new_tag('h2')
            title.string = line
            current_section.append(title)
        
        # Détecter les listes
        elif is_list_item(line):
            if not current_section:
                current_section = soup.new_tag('section', class_='pv-section')
            list_item = soup.new_tag('li')
            list_item.string = clean_list_item(line)
            # Chercher une liste existante ou en créer une
            existing_list = current_section.find('ul') or current_section.find('ol')
            if not existing_list:
                list_type = 'ol' if is_ordered_list(line) else 'ul'
                existing_list = soup.new_tag(list_type)
                current_section.append(existing_list)
            existing_list.append(list_item)
        
        # Texte normal
        else:
            if not current_section:
                current_section = soup.new_tag('section', class_='pv-section')
            para = soup.new_tag('p')
            para.string = line
            current_section.append(para)
    
    if current_section:
        page_div.append(current_section)
    
    # Ajouter les tableaux
    for table in tables:
        table_html = convert_table_to_html(table, soup)
        page_div.append(table_html)
    
    return str(page_div)


def identify_data_zones(html: str) -> str:
    """
    Identifie les zones de données dynamiques et les remplace par des placeholders
    
    Patterns à détecter :
    - Dates : "Date : 25/09/2025" → "Date : {{DATE_REUNION}}"
    - Participants : Liste de noms → {{#PARTICIPANTS}}...{{/PARTICIPANTS}}
    - Contenu : Section principale → {{TRANSCRIPT_CONTENT}}
    """
    
    # Pattern pour les dates
    date_patterns = [
        r'Date\s*:\s*\d{1,2}/\d{1,2}/\d{4}',
        r'\d{1,2}/\d{1,2}/\d{4}',
        r'Le\s+\d{1,2}\s+\w+\s+\d{4}'
    ]
    
    for pattern in date_patterns:
        html = re.sub(pattern, '{{DATE_REUNION}}', html, flags=re.IGNORECASE)
    
    # Pattern pour "Présents" / "Participants"
    html = re.sub(
        r'(Présents?|Participants?)[\s:]*\n(.*?)(?=\n\n|\n[A-Z]|$)',
        r'<h2>{{#PARTICIPANTS_TITLE}}</h2>\n<ul>{{#PARTICIPANTS}}<li>{{NOM}} - {{FONCTION}}</li>{{/PARTICIPANTS}}</ul>',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )
    
    # Pattern pour "Ordre du jour"
    html = re.sub(
        r'Ordre\s+du\s+jour[\s:]*\n(.*?)(?=\n\n|\n[A-Z]|$)',
        r'<h2>Ordre du jour</h2>\n<ol>{{#ORDRE_DU_JOUR}}<li>{{POINT}}</li>{{/ORDRE_DU_JOUR}}</ol>',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )
    
    # Pattern pour "Compte-rendu" / "Décisions"
    html = re.sub(
        r'(Compte-rendu|Décisions?)[\s:]*\n(.*?)(?=\n\n|\n[A-Z]|$)',
        r'<h2>{{#SECTION_TITLE}}</h2>\n<div class="pv-content">{{CONTENT}}</div>',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )
    
    return html


def extract_styles_from_page(page) -> List[Dict]:
    """
    Extrait les styles (polices, couleurs, tailles) d'une page
    """
    styles = []
    
    # Avec pdfplumber, on peut accéder aux caractères
    try:
        chars = page.chars
        for char in chars:
            style = {
                'font': char.get('fontname', ''),
                'size': char.get('size', 12),
                'color': char.get('non_stroking_color', '#000000'),
                'bold': 'Bold' in char.get('fontname', ''),
                'italic': 'Italic' in char.get('fontname', '')
            }
            if style not in styles:
                styles.append(style)
    except:
        # Fallback si l'extraction de caractères n'est pas disponible
        pass
    
    return styles


def extract_and_normalize_css(styles: List[Dict]) -> str:
    """
    Convertit les styles extraits en CSS normalisé
    """
    css_rules = []
    
    # Créer des classes CSS basées sur les styles détectés
    css_rules.append("""
    .pv-page {
        font-family: Arial, sans-serif;
        max-width: 210mm;
        margin: 0 auto;
        padding: 20mm;
    }
    
    .pv-section {
        margin-bottom: 1.5em;
    }
    
    .pv-section h2 {
        font-size: 1.2em;
        font-weight: bold;
        margin-top: 1em;
        margin-bottom: 0.5em;
    }
    
    .pv-content {
        line-height: 1.6;
        text-align: justify;
    }
    
    .pv-page ul, .pv-page ol {
        margin-left: 1.5em;
        padding-left: 0;
    }
    
    .pv-page li {
        margin-bottom: 0.3em;
    }
    
    @media print {
        .pv-page {
            page-break-after: auto;
        }
    }
    """)
    
    return '<style>\n' + '\n'.join(css_rules) + '\n</style>'


def create_default_data_mapping() -> Dict:
    """
    Crée le mapping de données par défaut pour un PV CSE
    """
    return {
        "DATE_REUNION": {
            "source": "metadata",
            "field": "date",
            "format": "DD/MM/YYYY",
            "default": "{{DATE_REUNION}}"
        },
        "LIEU_REUNION": {
            "source": "metadata",
            "field": "location",
            "default": "Non spécifié"
        },
        "PARTICIPANTS": {
            "source": "transcript",
            "extraction": "speakers",
            "format": "list",
            "template": "{{NOM}} - {{FONCTION}}"
        },
        "TRANSCRIPT_CONTENT": {
            "source": "transcript",
            "field": "fullText",
            "format": "formatted",
            "options": {
                "preserve_speakers": True,
                "preserve_timestamps": False
            }
        },
        "ORDRE_DU_JOUR": {
            "source": "ai_extraction",
            "prompt": "Extraire l'ordre du jour de la réunion. Retourner une liste JSON de points.",
            "format": "list"
        },
        "DECISIONS": {
            "source": "ai_extraction",
            "prompt": "Extraire les décisions prises lors de la réunion. Retourner une liste JSON avec pour chaque décision : texte, responsable (si mentionné), échéance (si mentionnée).",
            "format": "list"
        },
        "ACTIONS": {
            "source": "ai_extraction",
            "prompt": "Extraire les actions à suivre. Retourner une liste JSON avec pour chaque action : description, responsable, échéance.",
            "format": "list"
        }
    }


def is_title(line: str) -> bool:
    """Détecte si une ligne est un titre"""
    # Titres souvent en majuscules, ou avec une taille de police plus grande
    if line.isupper() and len(line) > 3:
        return True
    if re.match(r'^[A-Z][A-Z\s]{10,}$', line):
        return True
    return False


def is_list_item(line: str) -> bool:
    """Détecte si une ligne est un élément de liste"""
    # Patterns : "- item", "• item", "1. item", etc.
    patterns = [
        r'^[-•]\s+',
        r'^\d+[\.)]\s+',
        r'^[a-z][\.)]\s+'
    ]
    return any(re.match(p, line) for p in patterns)


def is_ordered_list(line: str) -> bool:
    """Détecte si c'est une liste ordonnée"""
    return bool(re.match(r'^\d+[\.)]\s+', line))


def clean_list_item(line: str) -> str:
    """Nettoie un élément de liste (enlève le préfixe)"""
    return re.sub(r'^[-•\d]+[\.)]?\s+', '', line).strip()


def convert_table_to_html(table: List[List], soup) -> str:
    """Convertit un tableau extrait en HTML"""
    table_tag = soup.new_tag('table', class_='pv-table')
    thead = soup.new_tag('thead')
    tbody = soup.new_tag('tbody')
    
    if table:
        # Première ligne = en-tête (supposition)
        header_row = soup.new_tag('tr')
        for cell in table[0]:
            th = soup.new_tag('th')
            th.string = str(cell) if cell else ''
            header_row.append(th)
        thead.append(header_row)
        
        # Lignes suivantes = données
        for row in table[1:]:
            tr = soup.new_tag('tr')
            for cell in row:
                td = soup.new_tag('td')
                td.string = str(cell) if cell else ''
                tr.append(td)
            tbody.append(tr)
    
    table_tag.append(thead)
    table_tag.append(tbody)
    return table_tag


# Exemple d'utilisation
if __name__ == '__main__':
    pdf_path = 'Backlog/Clients/procès verbale du 25.09.2025 validé le 16.10.2026 (1).pdf'
    account_id = 'cse-ouest@lavieaugrandair.fr'
    template_name = 'Template PV CSE Ouest'
    
    try:
        result = extract_pdf_to_template(pdf_path, account_id, template_name)
        
        # Sauvegarder le résultat
        output_file = f'template_{account_id.replace("@", "_")}.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Template extrait avec succès : {output_file}")
        print(f"   - HTML : {len(result['html_template'])} caractères")
        print(f"   - CSS : {len(result['css_styles'])} caractères")
        print(f"   - Mapping : {len(result['data_mapping'])} champs")
        
    except Exception as e:
        print(f"❌ Erreur lors de l'extraction : {e}")
        import traceback
        traceback.print_exc()

