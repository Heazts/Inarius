import React from 'react';
import { Shield, Zap, HelpCircle, Layout } from 'lucide-react';

export default function Header({ designStyle, setDesignStyle, dataSource, setDataSource, totalProducts, onShowHelp }) {
  return (
    <header className="app-header">
      <div className="header-content">
        {/* Brand & Logo */}
        <div className="header-brand">
          <div className="brand-icon-wrapper" style={{ overflow: 'hidden', padding: 0 }}>
            <img src="/inarius_icon.jpg" alt="Inarius Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div className="brand-title">
              Inarius
              <span className="brand-tag">v0.0.1 Beta</span>
              {dataSource === 'fonte_grande' && (
                <span className="brand-tag" style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }}>
                  Fonte Alternativa: Fonte Grande (PMC 20% Ceará)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
              <Zap style={{ width: '0.85rem', height: '0.85rem', color: 'var(--accent-primary)' }} />
              <span>
                {dataSource === 'fonte_grande' ? 'Fonte Alternativa CMED (20% ICMS CE)' : 'Base ABCFarma CE (20% ICMS)'} • {totalProducts || 17239} Itens
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="header-actions">
          {/* Data Source Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <select
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              className="style-select"
              style={{ borderColor: dataSource === 'fonte_grande' ? 'var(--accent-primary)' : 'var(--border-color)', fontWeight: 700 }}
              title="Alternar Fonte de Dados"
            >
              <option value="principal">Base Principal (17.2k)</option>
              <option value="fonte_grande">Fonte Grande CMED (Alternativa 20% CE)</option>
            </select>
          </div>

          {/* Design Style Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layout style={{ width: '0.85rem', height: '0.85rem', color: 'var(--text-muted)' }} />
            <select
              value={designStyle}
              onChange={(e) => setDesignStyle(e.target.value)}
              className="style-select"
              title="Escolha o Design System"
            >
              <option value="grok">Inarius (Grok Base)</option>
              <option value="vercel">Inarius (Vercel Base)</option>
            </select>
          </div>

          <button onClick={onShowHelp} className="btn" title="Dicas de Busca">
            <HelpCircle style={{ width: '0.95rem', height: '0.95rem', color: 'var(--accent-primary)' }} />
            <span>Ajuda</span>
          </button>
        </div>
      </div>
    </header>
  );
}
