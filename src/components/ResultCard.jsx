import React, { useMemo } from 'react';
import { Eye, Copy, FileText, Check, Award, Compass, ShieldCheck, Star } from 'lucide-react';

const parsePresentation = (pres) => {
  if (!pres) return { dosagem: 'N/D', forma: 'N/D', quantidade: 'N/D' };
  
  // Normalize OCR spelling discrepancies
  let cleanPres = pres
    .replace(/WOmg/g, '50mg')
    .replace(/\bOmg\b/g, '0mg')
    .replace(/soch/g, 'sach')
    .replace(/cop/g, 'comp')
    .replace(/comprev/g, 'comp rev')
    .replace(/coprev/g, 'comp rev')
    .replace(/capsor/g, 'cap sor');
  
  // 1. Extract dosage / concentration
  const dosageMatch = cleanPres.match(/(\d+(?:[.,]\d+)?(?:\s*\+\s*\d+(?:[.,]\d+)?)?\s*(?:mg|g|mcg|ml|%)(?:\/\d+\s*(?:ml|g)|font|\/ml|\/g)?)/i);
  const dosagem = dosageMatch ? dosageMatch[1].toLowerCase() : 'N/D';
  
  // 2. Extract pharmaceutical form
  let forma = 'N/D';
  const fl = cleanPres.toLowerCase();
  if (fl.includes('comp') || fl.includes('compr') || fl.includes('tab')) {
    forma = fl.includes('rev') || fl.includes('mast') 
      ? 'Comprimido Revestido / Especial' 
      : 'Comprimido Simples';
  } else if (fl.includes('cap') || fl.includes('cps') || fl.includes('gel')) {
    forma = 'Cápsula / Cápsula Gelatinosa';
  } else if (fl.includes('sach') || fl.includes('env') || fl.includes('gran')) {
    forma = 'Sachê / Granulado / Envelopes';
  } else if (fl.includes('xpe') || fl.includes('xarope') || fl.includes('xar')) {
    forma = 'Xarope';
  } else if (fl.includes('sus') || fl.includes('susp')) {
    forma = 'Suspensão Oral / Líquido';
  } else if (fl.includes('gota') || fl.includes('gts') || fl.includes('sol')) {
    forma = 'Solução Oral / Gotas';
  } else if (fl.includes('inj') || fl.includes('amp') || fl.includes('fa') || fl.includes('liof')) {
    forma = 'Injetável / Ampola / Pó Liofilizado';
  } else if (fl.includes('pom') || fl.includes('crem') || fl.includes('creme') || fl.includes('ung')) {
    forma = 'Uso Tópico (Pomada / Creme / Pomada / Gel)';
  } else if (fl.includes('oft') || fl.includes('colir')) {
    forma = 'Solução Oftálmica / Colírio';
  } else if (fl.includes('spr') || fl.includes('spray') || fl.includes('aer')) {
    forma = 'Spray / Inalação / Aerossol';
  } else if (fl.includes('fr')) {
    forma = 'Frasco / Suspensão';
  }

  // 3. Extract quantity + unit
  let quantidade = 'N/D';
  const qtyMatch = cleanPres.match(/(\d+)\s*(?:comp|cap|sach|env|amp|fa|fr|dose|cap|sug|tab|sach|bl)/i) ||
                   cleanPres.match(/(?:fr|cx|bl|env)\s*x?\s*(\d+)/i) ||
                   cleanPres.match(/(\d+)\s*(?:ml|g)\b/i);
  if (qtyMatch) {
    let unit = 'unidades';
    if (fl.includes('comp') || fl.includes('tab')) unit = 'comprimidos';
    else if (fl.includes('cap')) unit = 'cápsulas';
    else if (fl.includes('sach')) unit = 'sachês';
    else if (fl.includes('env')) unit = 'envelopes';
    else if (fl.includes('amp')) unit = 'ampolas';
    else if (fl.includes('fa')) unit = 'frasco-ampola';
    else if (fl.includes('ml')) unit = 'ml';
    else if (fl.includes('g')) unit = 'gramas';
    quantidade = `${qtyMatch[1]} ${unit}`;
  }

  return { dosagem, forma, quantidade };
};

export default function ResultCard({ item, query, onSelectProduct, isSelected, isFavorite, onToggleFavorite }) {
  const [copied, setCopied] = React.useState(false);

  const parsedInfo = useMemo(() => {
    return parsePresentation(item.presentation);
  }, [item.presentation]);

  const handleCopy = (e) => {
    e.stopPropagation();
    const copyText = `${item.name} (${item.substance || 'Princípio Ativo N/D'}) | Lab: ${item.lab} | Apresentação: ${item.presentation} | PF 20%: ${item.pf20} | PMC 20% (CE): ${item.pmc20} | Pág: ${item.page}`;
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightText = (text, highlight) => {
    if (!text) return '';
    if (!highlight || !highlight.trim()) return text;
    
    const terms = highlight.trim().split(/\s+/).filter(t => t.length > 1);
    if (terms.length === 0) return text;

    const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
      return isMatch ? (
        <mark key={i} className="highlight">
          {part}
        </mark>
      ) : (
        part
      );
    });
  };

  // Expanded View
  if (isSelected) {
    return (
      <div
        className="result-card result-card-selected"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          cursor: 'default',
          borderLeft: '4px solid var(--border-active)',
          transition: 'all 0.15s ease'
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifycontent: 'space-between', alignitems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {highlightText(item.name, query)}
            </h3>
            {item.substance && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldCheck style={{ width: '0.8rem', height: '0.8rem', color: 'var(--text-primary)', flexShrink: 0 }} />
                <span>Substância: <strong>{highlightText(item.substance, query)}</strong></span>
              </p>
            )}
            {item.isFonteGrande && (
              <div style={{ marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--accent-glow)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }}>
                  Fonte Alternativa: Fonte Grande CMED (PMC 20% Ceará)
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              onClick={onToggleFavorite}
              className="btn"
              style={{ padding: '0.3rem 0.5rem', borderColor: isFavorite ? 'var(--accent-primary)' : 'var(--border-color)', background: isFavorite ? 'var(--accent-glow)' : 'transparent' }}
              title={isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
            >
              <Star style={{ width: '0.85rem', height: '0.85rem', color: isFavorite ? 'var(--accent-primary)' : 'var(--text-muted)', fill: isFavorite ? 'var(--accent-primary)' : 'none' }} />
            </button>
            <button
              onClick={handleCopy}
              className="btn"
              style={{ padding: '0.3rem 0.5rem' }}
              title="Copiar dados estruturados"
            >
              {copied ? (
                <Check style={{ width: '0.85rem', height: '0.85rem', color: 'var(--text-primary)' }} />
              ) : (
                <Copy style={{ width: '0.85rem', height: '0.85rem' }} />
              )}
            </button>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.6rem 0.5rem',
          background: 'var(--bg-surface-elevated)',
          padding: '0.75rem',
          borderRadius: 'var(--border-radius)',
          border: '1px solid var(--border-color)',
          fontSize: '0.72rem',
          lineHeight: 1.4
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', textTransform: 'uppercase' }}>Laboratório</span>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{highlightText(item.lab, query)}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', textTransform: 'uppercase' }}>Concentração</span>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{parsedInfo.dosagem}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', textTransform: 'uppercase' }}>Forma Farmacêutica</span>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{parsedInfo.forma}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', textTransform: 'uppercase' }}>Quantidade</span>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{parsedInfo.quantidade}</p>
          </div>
          <div style={{ gridColumn: 'span 2', marginTop: '0.25rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', textTransform: 'uppercase' }}>Apresentação de Origem (ABCFarma)</span>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{highlightText(item.presentation, query)}</p>
          </div>
        </div>

        {/* Monochromatic high contrast Price Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.1fr',
          gap: '0.5rem'
        }}>
          <div style={{
            padding: '0.5rem 0.6rem',
            borderRadius: 'var(--border-radius)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', fontWeight: 700 }}>PF 20% CE</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>{item.pf20}</span>
          </div>

          {/* High Contrast Monochromatic PMC Card (Inverted colors!) */}
          <div style={{
            padding: '0.5rem 0.65rem',
            borderRadius: 'var(--border-radius)',
            background: 'var(--text-primary)',
            border: '1px solid var(--text-primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.625rem', color: 'var(--bg-app)', fontWeight: 850 }}>PMC 20% CEARÁ</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--bg-app)', fontWeight: 900 }}>{item.pmc20}</span>
          </div>
        </div>

        {/* Link / Button Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '0.5rem',
          marginTop: '0.15rem'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <FileText style={{ width: '0.75rem', height: '0.75rem' }} />
            Origem: {item.section}
          </span>
          <button
            onClick={() => onSelectProduct(item)}
            className="btn"
            style={{
              padding: '0.2rem 0.5rem',
              fontSize: '0.65rem'
            }}
          >
            <Compass style={{ width: '0.75rem', height: '0.75rem' }} />
            <span>Focar Página {item.page}</span>
          </button>
        </div>
      </div>
    );
  }

  // Collapsed View
  return (
    <div
      onClick={() => onSelectProduct(item)}
      className="result-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem'
      }}
    >
      <div className="card-top">
        <div>
          <h3 style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.0125em',
            lineHeight: 1.2
          }}>
            {highlightText(item.name, query)}
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Award style={{ width: '0.75rem', height: '0.75rem', color: 'var(--text-muted)' }} />
            <span>{highlightText(item.lab, query)}</span>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
          <button 
            onClick={onToggleFavorite} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
            title={isFavorite ? "Favoritado" : "Favoritar"}
          >
            <Star style={{ width: '0.85rem', height: '0.85rem', color: isFavorite ? 'var(--accent-primary)' : 'var(--text-muted)', fill: isFavorite ? 'var(--accent-primary)' : 'none' }} />
          </button>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.2rem' }}>PMC 20% CE</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 800 }}>{item.pmc20}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%', color: 'var(--text-secondary)' }}>
          {highlightText(item.presentation, query)}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          Pág. {item.page}
        </span>
      </div>
    </div>
  );
}
