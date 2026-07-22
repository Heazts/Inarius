import React, { useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, Sparkles, Command } from 'lucide-react';

export default function SearchBar({
  query,
  setQuery,
  resultsCount,
  searchTimeMs,
  selectedCategory,
  setSelectedCategory,
  categories
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="search-container">
      {/* Search Input Input */}
      <div className="search-input-wrapper">
        <Search className="search-input-icon" style={{ width: '1.15rem', height: '1.15rem' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite o nome do remédio, princípio ativo, laboratório ou página (ex: Cisteil, Paracetamol, Geolab, p.45)..."
          className="search-input"
        />
        <div style={{ position: 'absolute', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              title="Limpar busca"
            >
              <X style={{ width: '1rem', height: '1rem' }} />
            </button>
          )}
          <kbd style={{
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            padding: '0.15rem 0.35rem',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.25rem',
            color: 'var(--text-muted)',
            display: 'flex',
            align: 'center',
            gap: '2px'
          }}>
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Filter Row & Speed Stat */}
      <div className="search-actions-bar">
        <div className="filter-pills">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`pill ${selectedCategory === cat ? 'pill-active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          {query && (
            <>
              <span>
                <strong style={{ color: 'var(--accent-primary)' }}>{resultsCount}</strong> resultado{resultsCount !== 1 ? 's' : ''}
              </span>
              {searchTimeMs !== null && (
                <span style={{
                  padding: '0.15rem 0.4rem',
                  borderRadius: '0.25rem',
                  background: 'var(--bg-surface-elevated)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-color)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <Sparkles style={{ width: '0.75rem', height: '0.75rem', color: 'var(--accent-warn)' }} />
                  {searchTimeMs.toFixed(1)}ms
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
