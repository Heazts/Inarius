import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import ResultCard from './components/ResultCard';
import PdfViewer from './components/PdfViewer';
import Sidebar from './components/Sidebar';
import MissingMedications from './components/MissingMedications';
import { Search } from 'lucide-react';
import { executeSearch, buildSearchIndex } from './utils/searchEngine.js';

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
  const [isApproximate, setIsApproximate] = useState(false);
  
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

  // Missing Medications State (Local Storage) -- lista de nomes que a busca
  // nao encontrou, para conferir depois na revista fisica ou repassar a
  // quem atualiza a base de dados.
  const [missingMeds, setMissingMeds] = useState(() => {
    try {
      const saved = localStorage.getItem('inarius_missing_meds');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('inarius_missing_meds', JSON.stringify(missingMeds));
  }, [missingMeds]);

  const addMissingMed = (term) => {
    setMissingMeds(prev => {
      const alreadyExists = prev.some(it => it.term.toLowerCase() === term.toLowerCase());
      if (alreadyExists) return prev;
      return [...prev, { id: Date.now(), term, timestamp: new Date().toISOString() }];
    });
  };

  const removeMissingMed = (id) => {
    setMissingMeds(prev => prev.filter(it => it.id !== id));
  };

  // Fetch JSON databases
  useEffect(() => {
    setLoading(true);

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

  // Indice de busca pre-computado uma unica vez por conjunto de dados
  // (nao a cada tecla digitada), evitando refazer a normalizacao dos
  // ~17 mil produtos em toda busca.
  const searchIndex = useMemo(() => buildSearchIndex(productsData), [productsData]);

  // Execute reactive search using our high-precision Multi-Token & Fuzzy Search Engine
  useEffect(() => {
    if (!query.trim() || productsData.length === 0) {
      setSearchResults([]);
      setSearchTimeMs(null);
      return;
    }

    const t0 = performance.now();

    // 1. Execute Multi-Token + Fuzzy Engine Search (com fallback parcial/aproximado)
    let results = executeSearch(searchIndex, query);
    const wasApproximate = !!results.isApproximate;

    // 2. Filter by selected category pill
    if (selectedCategory === 'Favoritos') {
      results = results.filter((item) => favorites.includes(item.id));
    } else if (selectedCategory !== 'Tudo') {
      results = results.filter((item) => item.section.includes(selectedCategory));
    }

    const t1 = performance.now();
    setSearchTimeMs(t1 - t0);
    setIsApproximate(wasApproximate);
    setSearchResults(results);
  }, [query, searchIndex, selectedCategory, favorites]);

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
                  {isApproximate && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.25rem 0.1rem' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Nao encontramos "{query}" exatamente. Mostrando os medicamentos com nome mais parecido.
                      </p>
                      <button
                        onClick={() => addMissingMed(query.trim())}
                        className="btn"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', flexShrink: 0 }}
                      >
                        Não é isso? Anotar
                      </button>
                    </div>
                  )}
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
                  <button
                    onClick={() => addMissingMed(query.trim())}
                    className="btn"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', margin: '0.6rem auto 0' }}
                  >
                    Adicionar "{query}" à lista de pendências
                  </button>
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
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <MissingMedications
              items={missingMeds}
              onAdd={addMissingMed}
              onRemove={removeMissingMed}
            />
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
