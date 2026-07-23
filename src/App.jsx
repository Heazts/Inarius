import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import ResultCard from './components/ResultCard';
import PdfViewer from './components/PdfViewer';
import Sidebar from './components/Sidebar';
import { Search } from 'lucide-react';
import { executeSearch } from './utils/searchEngine';

export default function App() {
  const [pagesData, setPagesData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tudo');
  const [currentPage, setCurrentPage] = useState(1);
  const [designStyle, setDesignStyle] = useState('vercel'); // Design system selector (grok or vercel)
  const [showHelp, setShowHelp] = useState(false);
  const [searchTimeMs, setSearchTimeMs] = useState(null);
  
  // Favorites State (Local Storage)
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('inarius_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('inarius_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (productId, e) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Fetch JSON databases in parallel on startup
  useEffect(() => {
    Promise.all([
      fetch('/pdf_data.json').then((res) => res.json()),
      fetch('/products.json').then((res) => res.json())
    ])
      .then(([pages, products]) => {
        setPagesData(pages);
        setProductsData(products);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao carregar os dados cadastrados:', err);
        setLoading(false);
      });
  }, []);

  // Execute reactive search using our high-precision Multi-Token & Fuzzy Search Engine
  useEffect(() => {
    if (!query.trim() || productsData.length === 0) {
      setSearchResults([]);
      setSearchTimeMs(null);
      return;
    }

    const t0 = performance.now();

    // 1. Execute Multi-Token + Fuzzy Engine Search
    let results = executeSearch(productsData, query);

    // 2. Filter by selected category pill
    if (selectedCategory === 'Favoritos') {
      results = results.filter((item) => favorites.includes(item.id));
    } else if (selectedCategory !== 'Tudo') {
      results = results.filter((item) => item.section.includes(selectedCategory));
    }

    const t1 = performance.now();
    setSearchTimeMs(t1 - t0);
    setSearchResults(results);
  }, [query, productsData, selectedCategory, favorites]);

  // Auto-select the first product result when searchResults updates
  useEffect(() => {
    if (searchResults.length > 0) {
      setSelectedProductId(searchResults[0].id);
      setCurrentPage(searchResults[0].page);
    } else {
      setSelectedProductId(null);
    }
  }, [searchResults]);

  const categories = ['Tudo', 'Favoritos', 'Lista A-Z', 'Central de Preços', 'Orientações'];

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.id);
    setCurrentPage(product.page);
  };

  const handleNextResult = () => {
    if (searchResults.length <= 1) return;
    const currentIndex = searchResults.findIndex(r => r.id === selectedProductId);
    const nextIndex = (currentIndex + 1) % searchResults.length;
    handleSelectProduct(searchResults[nextIndex]);
  };

  const handlePrevResult = () => {
    if (searchResults.length <= 1) return;
    const currentIndex = searchResults.findIndex(r => r.id === selectedProductId);
    const prevIndex = currentIndex <= 0 ? searchResults.length - 1 : currentIndex - 1;
    handleSelectProduct(searchResults[prevIndex]);
  };

  const handleSelectPage = (pageNum) => {
    setCurrentPage(pageNum);
  };

  const currentPageData = pagesData.find((p) => p.page === currentPage) || null;

  return (
    <div className={`app-container style-${designStyle}`}>
      {/* Header */}
      <Header
        designStyle={designStyle}
        setDesignStyle={setDesignStyle}
        totalProducts={productsData.length}
        onShowHelp={() => setShowHelp(true)}
      />

      {/* Main Workspace Layout */}
      <main className="workspace">
        {/* Left Column: Search & Results */}
        <div className="left-panel">
          {/* 1. Search Bar */}
          <SearchBar
            query={query}
            setQuery={setQuery}
            resultsCount={searchResults.length}
            searchTimeMs={searchTimeMs}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
          />

          {/* 2. Search Results Display (PLACED DIRECTLY BELOW THE SEARCH BAR!) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="results-header">
              <h2 className="results-title">
                <Search style={{ width: '0.9rem', height: '0.9rem', color: 'var(--accent-primary)' }} />
                {query ? `Resultados (${searchResults.length})` : 'Medicamentos Recentes'}
              </h2>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {query && searchResults.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={handlePrevResult} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}>Anterior</button>
                    <button onClick={handleNextResult} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}>Próximo</button>
                  </div>
                )}
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Limpar pesquisa
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="result-card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  border: '2px solid var(--accent-primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 0.5rem'
                }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Indexando banco de medicamentos...</p>
              </div>
            ) : query ? (
              searchResults.length > 0 ? (
                <div className="results-scroll-container">
                  {searchResults.map((item) => (
                      <ResultCard
                        key={item.id}
                        item={item}
                        query={query}
                        onSelectProduct={handleSelectProduct}
                        isSelected={selectedProductId === item.id}
                        isFavorite={favorites.includes(item.id)}
                        onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                      />
                  ))}
                </div>
              ) : (
                <div className="result-card" style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Nenhum medicamento encontrado para "{query}"
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Verifique a grafia ou tente termos aproximados.
                  </p>
                </div>
              )
            ) : (
              <div className="results-scroll-container">
                {/* Default catalog directory preview */}
                {productsData.slice(0, 30).map((item) => (
                  <ResultCard
                    key={item.id}
                    item={item}
                    query=""
                    onSelectProduct={handleSelectProduct}
                    isSelected={selectedProductId === item.id}
                    isFavorite={favorites.includes(item.id)}
                    onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  />
                ))}
                {productsData.length > 30 && (
                  <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                    Exibindo catálogo inicial. Use a barra de busca acima para pesquisar entre todos os {productsData.length} medicamentos cadastrados.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Sidebar navigation widgets (PLACED AT THE BOTTOM OF LEFT COLUMN!) */}
          <div style={{ marginTop: '0.5rem' }}>
            <Sidebar
              pagesData={pagesData}
              onJumpToPage={handleSelectPage}
              currentPage={currentPage}
            />
          </div>
        </div>

        {/* Right Column: PDF Viewer */}
        <div className="sticky-viewer">
          <PdfViewer
            currentPage={currentPage}
            totalPages={pagesData.length || 200}
            pageData={currentPageData}
            onPageChange={handleSelectPage}
            searchQuery={query}
          />
        </div>
      </main>
    </div>
  );
}
