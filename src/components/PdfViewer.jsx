import React, { useState, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Maximize2
} from 'lucide-react';

export default function PdfViewer({ currentPage, totalPages, pageData, onPageChange, searchQuery }) {
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState('image'); // 'image' or 'text'
  const [copied, setCopied] = useState(false);
  const [showRuler, setShowRuler] = useState(true); // highlight 20% PMC columns by default
  const [pageWords, setPageWords] = useState([]);
  const viewerRef = React.useRef(null);

  // Panning State (mouse drag-to-move using native scroll)
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300)); // up to 300% zoom
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 60));
  const handleResetZoom = () => {
    setZoom(100);
  };

  // Wheel zoom handler
  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        handleResetZoom();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopyText = () => {
    if (pageData?.text) {
      navigator.clipboard.writeText(pageData.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Load word coordinates for current page
  useEffect(() => {
    setPageWords([]);
    fetch(`/pages/page_${currentPage}.words.json`)
      .then((res) => {
        if (!res.ok) throw new Error('No coordinates file');
        return res.json();
      })
      .then((data) => {
        setPageWords(data);
      })
      .catch((err) => {
        console.warn(`Coordenadas não disponíveis para página ${currentPage}:`, err);
      });
  }, [currentPage]);

  // Reset scrolling to top when page changes
  useEffect(() => {
    const viewport = document.getElementById('pdf-viewport');
    if (viewport) {
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    }
  }, [currentPage]);

  // Find word highlight rects matching search query
  const matchedRects = useMemo(() => {
    if (!searchQuery || !searchQuery.trim() || pageWords.length === 0) return [];
    
    // tokenize search terms
    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 1);
    if (terms.length === 0) return [];

    return pageWords.filter((w) => {
      const wordText = w[4].toLowerCase().replace(/[^\w]/g, '');
      return terms.some(t => {
        const cleanT = t.replace(/[^\w]/g, '');
        return wordText.includes(cleanT) || cleanT.includes(wordText);
      });
    });
  }, [pageWords, searchQuery]);

  // Auto-focus on search results
  useEffect(() => {
    if (matchedRects.length > 0 && viewerRef.current) {
      // Find the first matched word
      const firstMatch = matchedRects[0];
      
      // Auto-zoom for readability if current zoom is too small
      if (zoom < 150) {
        setZoom(150);
      }
      
      // We want to center it. The matched rect gives us percentages for top/left.
      // We calculate absolute pixels relative to the zoomed container
      setTimeout(() => {
        if (!viewerRef.current) return;
        const viewport = viewerRef.current;
        const imgContainer = viewport.querySelector('.pdf-zoom-container');
        if (!imgContainer) return;
        
        const containerWidth = imgContainer.offsetWidth;
        const containerHeight = imgContainer.offsetHeight;
        
        // Target element absolute center point
        const targetX = (firstMatch[0] / 100) * containerWidth;
        const targetY = (firstMatch[1] / 100) * containerHeight;
        
        // Scroll so this point is in the center of the viewport
        const scrollLeft = targetX - (viewport.clientWidth / 2);
        const scrollTop = targetY - (viewport.clientHeight / 2);
        
        viewport.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }, 300); // Wait a bit for DOM to apply zoom/width
    }
  }, [matchedRects]);

  // Calculate high precision 20% PMC columns by checking page word coords dynamically
  const calculatedRulers = useMemo(() => {
    // Default fallback values if headers are not found on the page
    let leftRuler = { left: 18.1, width: 5.8 };
    let rightRuler = { left: 61.2, width: 7.4 };
    
    if (pageWords.length === 0) return { leftRuler, rightRuler };
    
    // Find '20%' headers near the top of the table page
    const headers20 = pageWords.filter(
      (w) => w[4] === '20%' && w[1] <= 15
    );
    
    // Find 'PMC' headers near the top of the table page
    const pmcHeaders = pageWords.filter(
      (w) => w[4] === 'PMC' && w[1] <= 15
    );
    
    // Dynamic left column ruler calculation
    const left20 = headers20.find((h) => h[0] < 50);
    if (left20) {
      const matchingPmc = pmcHeaders.find((p) => p[0] >= left20[0] && p[0] < left20[0] + 5);
      const rightBound = matchingPmc ? matchingPmc[2] : left20[2] + 2.5;
      leftRuler = {
        left: left20[0] - 0.25,
        width: rightBound - left20[0] + 0.5
      };
    }
    
    // Dynamic right column ruler calculation
    const right20 = headers20.find((h) => h[0] >= 50);
    if (right20) {
      const matchingPmc = pmcHeaders.find((p) => p[0] >= right20[0] && p[0] < right20[0] + 5);
      const rightBound = matchingPmc ? matchingPmc[2] : right20[2] + 2.5;
      rightRuler = {
        left: right20[0] - 0.25,
        width: rightBound - right20[0] + 0.5
      };
    }
    
    return { leftRuler, rightRuler };
  }, [pageWords]);

  const handleMouseDown = (e) => {
    // Enable free drag panning on left mouse click
    if (e.button !== 0) return;
    const viewport = document.getElementById('pdf-viewport');
    if (viewport) {
      setIsPanning(true);
      setStartPos({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    e.preventDefault();
    const viewport = document.getElementById('pdf-viewport');
    if (viewport) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      viewport.scrollLeft = startPos.scrollLeft - dx;
      viewport.scrollTop = startPos.scrollTop - dy;
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };


  return (
    <div className="viewer-container">
      {/* Viewer Toolbar */}
      <div className="viewer-toolbar">
        {/* Navigation */}
        <div className="viewer-nav">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="btn"
            style={{ padding: '0.35rem 0.5rem' }}
            title="Página Anterior"
          >
            <ChevronLeft style={{ width: '0.9rem', height: '0.9rem' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Pág.</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= totalPages) onPageChange(val);
              }}
              className="viewer-page-input"
            />
            <span style={{ color: 'var(--text-muted)' }}>/ {totalPages}</span>
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="btn"
            style={{ padding: '0.35rem 0.5rem' }}
            title="Próxima Página"
          >
            <ChevronRight style={{ width: '0.9rem', height: '0.9rem' }} />
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="mode-toggle-group">
          <button
            onClick={() => setViewMode('image')}
            className={`mode-toggle-btn ${viewMode === 'image' ? 'mode-toggle-active' : ''}`}
          >
            <ImageIcon style={{ width: '0.85rem', height: '0.85rem' }} />
            <span>Imagem</span>
          </button>
          <button
            onClick={() => setViewMode('text')}
            className={`mode-toggle-btn ${viewMode === 'text' ? 'mode-toggle-active' : ''}`}
          >
            <FileText style={{ width: '0.85rem', height: '0.85rem' }} />
            <span>OCR</span>
          </button>
        </div>

        {/* 20% Column Highlight Ruler Switch */}
        {viewMode === 'image' && (
          <button
            onClick={() => setShowRuler(!showRuler)}
            className="btn"
            style={{
              padding: '0.35rem 0.65rem',
              borderColor: showRuler ? 'var(--border-active)' : 'var(--border-color)',
              background: showRuler ? 'var(--bg-surface-elevated)' : 'transparent'
            }}
            title="Destacar colunas de 20% e PMC da tabela"
          >
            {showRuler ? (
              <ToggleRight style={{ width: '1.1rem', height: '1.1rem', color: 'var(--text-primary)' }} />
            ) : (
              <ToggleLeft style={{ width: '1.1rem', height: '1.1rem', color: 'var(--text-muted)' }} />
            )}
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>
              Guia 20% PMC
            </span>
          </button>
        )}

        {/* Zoom Controls (Image mode only) */}
        {viewMode === 'image' && (
          <div className="viewer-zoom-controls">
            <button onClick={handleZoomOut} className="btn" style={{ padding: '0.35rem 0.5rem' }} title="Diminuir Zoom">
              <ZoomOut style={{ width: '0.85rem', height: '0.85rem' }} />
            </button>
            <span className="viewer-zoom-label">{zoom}%</span>
            <button onClick={handleZoomIn} className="btn" style={{ padding: '0.35rem 0.5rem' }} title="Aumentar Zoom (Máx 300%)">
              <ZoomIn style={{ width: '0.85rem', height: '0.85rem' }} />
            </button>
            <button onClick={handleResetZoom} className="btn" style={{ padding: '0.35rem 0.5rem' }} title="Centralizar e Resetar Zoom">
              <RotateCcw style={{ width: '0.85rem', height: '0.85rem' }} />
            </button>
          </div>
        )}

        {/* Actions */}
        <button onClick={handleCopyText} className="btn" title="Copiar texto da página">
          {copied ? (
            <Check style={{ width: '0.85rem', height: '0.85rem' }} />
          ) : (
            <Copy style={{ width: '0.85rem', height: '0.85rem' }} />
          )}
          <span>Copiar</span>
        </button>
      </div>

      {/* Main Viewport with Native Scrolling and Drag Panning */}
      <div
        id="pdf-viewport"
        ref={viewerRef}
        className="viewer-viewport"
        onMouseDown={viewMode === 'image' ? handleMouseDown : undefined}
        onMouseMove={viewMode === 'image' ? handleMouseMove : undefined}
        onMouseUp={viewMode === 'image' ? handleMouseUp : undefined}
        onMouseLeave={viewMode === 'image' ? handleMouseUp : undefined}
        onWheel={viewMode === 'image' ? handleWheel : undefined}
        style={{
          cursor: viewMode === 'image' ? (isPanning ? 'grabbing' : 'grab') : 'default',
          overflow: 'auto',
          position: 'relative',
          userSelect: 'none'
        }}
      >
        {viewMode === 'image' ? (
          <div
            className="pdf-zoom-container"
            style={{
              position: 'relative',
              display: 'block',
              width: `${zoom}%`,
              minWidth: `${zoom}%`,
              flexShrink: 0,
              margin: '0 auto',
              transition: 'width 0.15s ease-out, min-width 0.15s ease-out'
            }}
          >
            {/* Base PDF Rendered Page Image */}
            <img
              src={`/pages/page_${currentPage}.jpg`}
              alt={`Página ${currentPage} Revista ABCFarma`}
              className="viewer-pdf-img"
              style={{ display: 'block', width: '100%', height: 'auto', transform: 'none', boxShadow: 'none' }}
              loading="eager"
            />

            {/* Keyword highlights overlay in VIVID RED */}
            {matchedRects.map((w, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${w[0]}%`,
                  top: `${w[1]}%`,
                  width: `${w[2] - w[0]}%`,
                  height: `${w[3] - w[1]}%`,
                  backgroundColor: 'rgba(239, 68, 68, 0.3)', // Vivid Red highlight overlay
                  border: '2px solid #ef4444',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
                  borderRadius: '2px',
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              />
            ))}

            {/* High Precision 20% PMC Column Highlight Ruler Guides (Vivid BLUE Lines) */}
            {showRuler && currentPage >= 12 && currentPage <= 198 && (
              <>
                {/* Left Column 20% Guide */}
                <div style={{
                  position: 'absolute',
                  left: `${calculatedRulers.leftRuler.left}%`,
                  top: '10.5%',
                  width: `${calculatedRulers.leftRuler.width}%`,
                  height: '88.5%',
                  backgroundColor: 'rgba(0, 112, 243, 0.08)', // soft blue stripe
                  borderLeft: '2px solid #0070f3', // Sharp precision blue line
                  borderRight: '2px solid #0070f3',
                  boxShadow: '0 0 6px rgba(0, 112, 243, 0.4)',
                  pointerEvents: 'none',
                  zIndex: 5
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-18px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#0070f3',
                    color: '#ffffff',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    padding: '1px 4px',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap'
                  }}>PMC 20%</div>
                </div>
                {/* Right Column 20% Guide */}
                <div style={{
                  position: 'absolute',
                  left: `${calculatedRulers.rightRuler.left}%`,
                  top: '10.5%',
                  width: `${calculatedRulers.rightRuler.width}%`,
                  height: '88.5%',
                  backgroundColor: 'rgba(0, 112, 243, 0.08)',
                  borderLeft: '2px solid #0070f3',
                  borderRight: '2px solid #0070f3',
                  boxShadow: '0 0 6px rgba(0, 112, 243, 0.4)',
                  pointerEvents: 'none',
                  zIndex: 5
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-18px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#0070f3',
                    color: '#ffffff',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    padding: '1px 4px',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap'
                  }}>PMC 20%</div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div className="viewer-text-pane">
              {pageData?.text || 'Texto OCR não disponível para esta página.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
