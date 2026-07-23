/**
 * Inarius Ultra-Precision Multi-Token & Fuzzy Search Engine
 * Features: Multi-token AND matching, Levenshtein Fuzzy, Abbreviation Synonym Expansion, Weighted Scoring
 */

export function normalizeStr(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Common Brazilian pharmaceutical OCR abbreviations map
 */
const ABBREVIATIONS_MAP = {
  'GOTAS': ['GOTAS', 'GTAS', 'GTS', 'GTT'],
  'GOTA': ['GOTAS', 'GTAS', 'GTS', 'GTT'],
  'GTAS': ['GOTAS', 'GTAS', 'GTS'],
  'GTS': ['GOTAS', 'GTAS', 'GTS'],
  'COMPRIMIDO': ['COMPRIMIDO', 'COMPRIMIDOS', 'COMP', 'CPR', 'CAPS'],
  'COMPRIMIDOS': ['COMPRIMIDO', 'COMPRIMIDOS', 'COMP', 'CPR', 'CAPS'],
  'COMP': ['COMPRIMIDO', 'COMPRIMIDOS', 'COMP', 'CPR'],
  'CAPSULA': ['CAPSULA', 'CAPSULAS', 'CAPS', 'CAP'],
  'CAPSULAS': ['CAPSULA', 'CAPSULAS', 'CAPS', 'CAP'],
  'FRASCO': ['FRASCO', 'FR', 'FRC'],
  'FR': ['FRASCO', 'FR', 'FRC'],
  'SOLUCAO': ['SOLUCAO', 'SOL', 'SOLUC'],
  'SOL': ['SOLUCAO', 'SOL', 'SOLUC'],
  'SUSPENSAO': ['SUSPENSAO', 'SUSP', 'SUS'],
  'SUSP': ['SUSPENSAO', 'SUSP', 'SUS'],
  'INJETAVEL': ['INJETAVEL', 'INJ'],
  'POMADA': ['POMADA', 'POM'],
  'CREME': ['CREME', 'CRM'],
  'XAROPE': ['XAROPE', 'XPE']
};

/**
 * Calculates Levenshtein Distance for fuzzy matching OCR noise / typos
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Token matcher: checks exact substring, synonym expansion, or fuzzy word match
 */
function isTokenMatched(token, normFullText, wordsList) {
  // Expand synonyms if token exists in dictionary
  const tokenVariants = ABBREVIATIONS_MAP[token] || [token];

  for (let v = 0; v < tokenVariants.length; v++) {
    const variant = tokenVariants[v];

    // 1. Direct substring match (Fastest)
    if (normFullText.includes(variant)) return true;

    // 2. Fuzzy match for tokens with 4+ characters
    if (variant.length >= 4) {
      const maxDistance = variant.length >= 7 ? 2 : 1;
      for (let i = 0; i < wordsList.length; i++) {
        const w = wordsList[i];
        if (w.length >= 3 && Math.abs(w.length - variant.length) <= maxDistance) {
          if (levenshteinDistance(variant, w) <= maxDistance) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Main Search Execution Function
 */
export function executeSearch(products, query) {
  if (!query || !query.trim() || !products || products.length === 0) {
    return [];
  }

  const rawQuery = query.trim();

  // 1. Direct Page Match (e.g. "p.51", "pág 51", "51")
  const pageMatch = rawQuery.match(/^(?:p(?:ág|ag)?\.?\s*)?(\d{1,3})$/i);
  if (pageMatch) {
    const pageNum = parseInt(pageMatch[1], 10);
    if (pageNum >= 1 && pageNum <= 200) {
      return products.filter((p) => p.page === pageNum);
    }
  }

  // 2. Multi-Token Normalization
  const normQuery = normalizeStr(rawQuery);
  const tokens = normQuery
    .split(/[\s,.-]+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return [];

  const matched = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const normName = normalizeStr(p.name);
    const normSubstance = normalizeStr(p.substance);
    const normLab = normalizeStr(p.lab);
    const normPres = normalizeStr(p.presentation);

    const fullSearchStr = `${normName} ${normSubstance} ${normLab} ${normPres} PAGINA ${p.page}`;
    const wordsList = fullSearchStr.split(/\s+/);

    // Validate that ALL query tokens match the product full text
    let allTokensMatched = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!isTokenMatched(tokens[t], fullSearchStr, wordsList)) {
        allTokensMatched = false;
        break;
      }
    }

    if (allTokensMatched) {
      // Calculate weighted relevance score
      let score = 0;

      // Exact name match or prefix
      if (normName === normQuery) score += 250;
      else if (normName.startsWith(normQuery)) score += 150;
      else if (normName.includes(normQuery)) score += 80;

      // Token matches in name & fields
      for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if (normName.includes(tok)) score += 40;
        if (normSubstance.includes(tok)) score += 25;
        if (normPres.includes(tok)) score += 20;
        if (normLab.includes(tok)) score += 15;
      }

      matched.push({ product: p, score });
    }
  }

  // Sort by score descending
  matched.sort((a, b) => b.score - a.score);

  return matched.map((m) => m.product);
}
