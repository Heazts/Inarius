import React from 'react';
import { Bookmark, ListFilter, Compass, Sparkles } from 'lucide-react';

export default function Sidebar({
  pagesData,
  onJumpToPage,
  currentPage
}) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const findPageForLetter = (letter) => {
    if (!pagesData) return null;
    const match = pagesData.find((p) => {
      const sec = p.section || '';
      return sec.includes(`Lista A-Z (${letter})`);
    });
    return match ? match.page : null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Quick navigation */}
      <div className="sidebar-widget">
        <h3 className="widget-title">
          <Compass style={{ width: '0.9rem', height: '0.9rem', color: 'var(--accent-primary)' }} />
          Seções Rápidas
        </h3>
        <div className="quick-links">
          <button
            onClick={() => onJumpToPage(1)}
            className={`quick-link-btn ${currentPage === 1 ? 'quick-link-active' : ''}`}
          >
            <span>Capa & Editorial</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pág 1</span>
          </button>
          <button
            onClick={() => onJumpToPage(3)}
            className={`quick-link-btn ${currentPage === 3 ? 'quick-link-active' : ''}`}
          >
            <span>Central de Preços</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pág 3</span>
          </button>
          <button
            onClick={() => onJumpToPage(11)}
            className={`quick-link-btn ${currentPage === 11 ? 'quick-link-active' : ''}`}
          >
            <span>Orientações de Preço</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pág 11</span>
          </button>
        </div>
      </div>

      {/* A-Z Index */}
      <div className="sidebar-widget">
        <h3 className="widget-title">
          <ListFilter style={{ width: '0.9rem', height: '0.9rem', color: 'var(--accent-secondary)' }} />
          Tabela de Preços A-Z
        </h3>
        <div className="alphabet-grid">
          {alphabet.map((letter) => {
            const pageNum = findPageForLetter(letter);
            return (
              <button
                key={letter}
                onClick={() => pageNum && onJumpToPage(pageNum)}
                disabled={!pageNum}
                className="alpha-btn"
                title={pageNum ? `Ir para letra ${letter} (Página ${pageNum})` : `Não encontrada`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Widget */}
      <div className="sidebar-widget" style={{
        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.05), transparent)',
        borderColor: 'rgba(20, 184, 166, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          <Sparkles style={{ width: '0.85rem', height: '0.85rem', color: 'var(--accent-warn)' }} />
          <span>Motor Offline</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Toda a base de dados de preços e medicamentos está carregada no seu navegador. As pesquisas são feitas offline de forma instantânea.
        </p>
      </div>
    </div>
  );
}
