import React, { useState } from 'react';
import { ClipboardList, Plus, Trash2, Copy, Check } from 'lucide-react';

export default function MissingMedications({ items, onAdd, onRemove }) {
  const [term, setTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTerm('');
  };

  const handleCopy = () => {
    if (items.length === 0) return;
    const lines = items.map((it) => {
      const date = new Date(it.timestamp).toLocaleDateString('pt-BR');
      return `- ${it.term} (adicionado em ${date})`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sidebar-widget">
      <h3 className="widget-title">
        <ClipboardList style={{ width: '0.9rem', height: '0.9rem', color: 'var(--accent-warn)' }} />
        Medicamentos Não Encontrados
      </h3>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
        Não achou um medicamento na busca? Anote aqui para conferir depois na revista ou avisar quem atualiza a tabela.
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nome do medicamento..."
          style={{
            flex: 1,
            padding: '0.4rem 0.5rem',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            fontSize: '0.72rem'
          }}
        />
        <button type="submit" className="btn" style={{ padding: '0.4rem 0.55rem' }} title="Adicionar à lista">
          <Plus style={{ width: '0.8rem', height: '0.8rem' }} />
        </button>
      </form>

      {items.length === 0 ? (
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Nenhum pendente. Boa!</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '12rem', overflowY: 'auto', marginBottom: '0.5rem' }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  padding: '0.35rem 0.5rem',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface-elevated)'
                }}
              >
                <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.term}
                </span>
                <button
                  onClick={() => onRemove(it.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.15rem', flexShrink: 0 }}
                  title="Remover da lista"
                >
                  <Trash2 style={{ width: '0.75rem', height: '0.75rem', color: 'var(--text-muted)' }} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={handleCopy} className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: '0.7rem' }}>
            {copied ? (
              <Check style={{ width: '0.8rem', height: '0.8rem' }} />
            ) : (
              <Copy style={{ width: '0.8rem', height: '0.8rem' }} />
            )}
            <span>{copied ? 'Copiado!' : `Copiar lista (${items.length})`}</span>
          </button>
        </>
      )}
    </div>
  );
}
