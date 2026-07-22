import React from 'react';
import { Shield, Zap, HelpCircle, Layout } from 'lucide-react';

export default function Header({ designStyle, setDesignStyle, totalProducts, onShowHelp }) {
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
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
              <Zap style={{ width: '0.85rem', height: '0.85rem', color: 'var(--accent-primary)' }} />
              <span>Base ABCFarma CE (20% ICMS) • {totalProducts || 9203} Itens</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="header-actions">
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
