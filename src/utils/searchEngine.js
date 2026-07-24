/**
 * Inarius Ultra-Precision Multi-Token & Fuzzy Search Engine
 * Features: Indice pre-computado, matching parcial com fallback, Levenshtein
 * fuzzy, mapeamento de sinonimos farmaceuticos, scoring ponderado.
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
 * Distancia maxima tolerada para o fuzzy match de uma palavra, proporcional
 * ao tamanho dela (em vez de um limiar fixo por faixa de tamanho). Isso
 * deixa palavras longas tolerarem mais erros de digitacao/OCR sem abrir mao
 * de precisao em palavras curtas.
 */
function maxFuzzyDistance(len) {
  return Math.max(1, Math.min(3, Math.round(len * 0.3)));
}

/**
 * Pre-computa os campos normalizados e a lista de palavras de cada produto
 * uma unica vez, para nao ter que refazer esse trabalho a cada tecla
 * digitada na busca (antes isso era refeito do zero em toda chamada,
 * varrendo os ~17 mil produtos a cada keystroke).
 */
export function buildSearchIndex(products) {
  if (!products) return [];
  return products.map((p) => {
    const normName = normalizeStr(p.name);
    const normSubstance = normalizeStr(p.substance);
    const normLab = normalizeStr(p.lab);
    const normPres = normalizeStr(p.presentation);
    const fullSearchStr = `${normName} ${normSubstance} ${normLab} ${normPres} PAGINA ${p.page}`;
    const wordsList = fullSearchStr.split(/\s+/).filter(Boolean);
    return { product: p, normName, normSubstance, normLab, normPres, fullSearchStr, wordsList };
  });
}

/**
 * Token matcher: checks exact substring, synonym expansion, or fuzzy word match
 */
function isTokenMatched(token, normFullText, wordsList) {
  const tokenVariants = ABBREVIATIONS_MAP[token] || [token];

  for (let v = 0; v < tokenVariants.length; v++) {
    const variant = tokenVariants[v];

    // 1. Direct substring match (Fastest)
    if (normFullText.includes(variant)) return true;

    // 2. Fuzzy match for tokens with 4+ characters
    if (variant.length >= 4) {
      const maxDistance = maxFuzzyDistance(variant.length);
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

function scoreEntry(entry, normQuery, tokens) {
  const { normName, normSubstance, normPres, normLab } = entry;
  let score = 0;

  if (normName === normQuery) score += 250;
  else if (normName.startsWith(normQuery)) score += 150;
  else if (normName.includes(normQuery)) score += 80;

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (normName.includes(tok)) score += 40;
    if (normSubstance.includes(tok)) score += 25;
    if (normPres.includes(tok)) score += 20;
    if (normLab.includes(tok)) score += 15;
  }

  return score;
}

const MAX_RESULTS = 300;
const MAX_SUGGESTIONS = 20;

/**
 * Main Search Execution Function.
 *
 * Recebe o indice pre-computado (buildSearchIndex) em vez da lista crua de
 * produtos. Diferente da versao anterior -- que exigia TODOS os tokens da
 * busca baterem (E logico) e retornava um array vazio se um unico token
 * nao combinasse com nada -- agora a busca sempre tenta entregar o melhor
 * resultado possivel:
 *   1. Produtos que combinam com TODOS os tokens (mais relevantes).
 *   2. Se poucos ou nenhum resultado assim, tambem inclui produtos que
 *      combinam com PARTE dos tokens, ordenados por quantos tokens bateram.
 *   3. Se nada bateu com nenhum token (ex: erro de digitacao grande), cai
 *      num ultimo recurso: compara a busca inteira com o nome dos produtos
 *      via distancia de edicao e sugere os mais proximos.
 */
export function executeSearch(index, query) {
  if (!query || !query.trim() || !index || index.length === 0) {
    return [];
  }

  const rawQuery = query.trim();

  // 1. Direct Page Match (e.g. "p.51", "pág 51", "51")
  const pageMatch = rawQuery.match(/^(?:p(?:ág|ag)?\.?\s*)?(\d{1,3})$/i);
  if (pageMatch) {
    const pageNum = parseInt(pageMatch[1], 10);
    if (pageNum >= 1 && pageNum <= 200) {
      return index.filter((entry) => entry.product.page === pageNum).map((entry) => entry.product);
    }
  }

  // 2. Multi-Token Normalization
  const normQuery = normalizeStr(rawQuery);
  const tokens = normQuery
    .split(/[\s,.-]+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return [];

  const fullMatches = [];
  const partialMatches = [];

  for (let i = 0; i < index.length; i++) {
    const entry = index[i];

    let matchedCount = 0;
    for (let t = 0; t < tokens.length; t++) {
      if (isTokenMatched(tokens[t], entry.fullSearchStr, entry.wordsList)) {
        matchedCount += 1;
      }
    }

    if (matchedCount === 0) continue;

    const score = scoreEntry(entry, normQuery, tokens);
    if (matchedCount === tokens.length) {
      fullMatches.push({ product: entry.product, score });
    } else {
      partialMatches.push({ product: entry.product, score, matchedCount });
    }
  }

  fullMatches.sort((a, b) => b.score - a.score);
  partialMatches.sort((a, b) => (b.matchedCount - a.matchedCount) || (b.score - a.score));

  if (fullMatches.length > 0 || partialMatches.length > 0) {
    const combined = fullMatches.concat(partialMatches).slice(0, MAX_RESULTS);
    return combined.map((m) => m.product);
  }

  // 3. Ultimo recurso: nada bateu nem por substring nem por fuzzy em nenhum
  // token -- provavelmente um erro de digitacao grande. Compara a busca
  // inteira com o nome COMERCIAL e com a SUBSTANCIA (nome generico) de cada
  // produto e sugere os mais proximos, em vez de devolver uma lista vazia.
  // A substancia importa tanto quanto o nome aqui porque muitos produtos so
  // tem o nome de marca no campo "name" (ex: "ABLOK") com o principio ativo
  // que o usuario realmente busca (ex: "ATENOLOL") no campo "substance".
  const suggestions = [];
  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    let bestRatio = Infinity;
    if (entry.normName) {
      const d = levenshteinDistance(normQuery, entry.normName);
      bestRatio = Math.min(bestRatio, d / Math.max(normQuery.length, entry.normName.length, 1));
    }
    if (entry.normSubstance && entry.normSubstance !== entry.normName) {
      const d = levenshteinDistance(normQuery, entry.normSubstance);
      bestRatio = Math.min(bestRatio, d / Math.max(normQuery.length, entry.normSubstance.length, 1));
    }
    if (bestRatio <= 0.5) {
      suggestions.push({ product: entry.product, ratio: bestRatio });
    }
  }
  suggestions.sort((a, b) => a.ratio - b.ratio);
  const results = suggestions.slice(0, MAX_SUGGESTIONS).map((m) => m.product);
  results.isApproximate = results.length > 0;
  return results;
}
