const API_KEY = '8d64188f';
  const API_BASE = 'https://www.omdbapi.com/';

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const ratingSlider = document.getElementById('ratingSlider');
  const sliderValue = document.getElementById('sliderValue');
  const sortDirBtn = document.getElementById('sortDirBtn');
  const sortDirText = document.getElementById('sortDirText');
  const grid = document.getElementById('grid');
  const statusLine = document.getElementById('statusLine');

  let currentResults = [];   // full OMDb search results (basic info)
  let detailedCache = {};    // imdbID -> full detail object (with imdbRating)
  let sortDescending = true; // true = highest rating first

  function setStatus(text, isError = false){
    statusLine.textContent = text;
    statusLine.classList.toggle('error', isError);
  }

  function ratingClass(rating){
    if (rating === null || isNaN(rating)) return 'rating-na';
    if (rating >= 7) return 'rating-high';
    if (rating >= 5) return 'rating-mid';
    return 'rating-low';
  }

  function renderEmpty(message, sub){
    grid.innerHTML = `
      <div class="empty-state">
        <span class="big">${message}</span>
        ${sub || ''}
      </div>`;
  }

  function renderLoading(){
    grid.innerHTML = `
      <div class="loading-state">
        <div class="reel"></div>
        Rolling film…
      </div>`;
  }

  function renderGrid(movies){
    if (!movies.length){
      renderEmpty('No matches in the archive.', 'Try a different title or lower the rating threshold.');
      return;
    }

    grid.innerHTML = movies.map(m => {
      const hasPoster = m.Poster && m.Poster !== 'N/A';
      const ratingNum = m.imdbRating && m.imdbRating !== 'N/A' ? parseFloat(m.imdbRating) : null;
      const ratingLabel = ratingNum !== null ? ratingNum.toFixed(1) : '—';
      const cls = ratingClass(ratingNum);
      const hasPlot = m.Plot && m.Plot !== 'N/A';
      const plotText = hasPlot ? m.Plot : 'No synopsis available for this title.';

      return `
        <div class="poster-card">
          <div class="poster-img-wrap">
            ${hasPoster
              ? `<img src="${m.Poster}" alt="${escapeHtml(m.Title)} poster" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-fallback\\'>${escapeHtml(m.Title)}</div>'" />`
              : `<div class="poster-fallback">${escapeHtml(m.Title)}</div>`
            }
            <div class="ticket ${cls}">${ratingLabel}</div>
            <div class="plot-overlay">
              <p class="plot-overlay-title">${escapeHtml(m.Title)}</p>
              <p class="plot-overlay-text">${escapeHtml(plotText)}</p>
            </div>
          </div>
          <div class="card-body">
            <p class="card-title">${escapeHtml(m.Title)}</p>
            <p class="card-year">${escapeHtml(m.Year || '')}</p>
          </div>
        </div>`;
    }).join('');
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function applySortAndFilterAndRender(){
    const threshold = parseFloat(ratingSlider.value);

    let filtered = currentResults.filter(m => {
      const r = m.imdbRating && m.imdbRating !== 'N/A' ? parseFloat(m.imdbRating) : null;
      if (threshold <= 0) return true; // show all, including unrated, at minimum threshold
      return r !== null && r >= threshold;
    });

    filtered.sort((a, b) => {
      const ra = a.imdbRating && a.imdbRating !== 'N/A' ? parseFloat(a.imdbRating) : -1;
      const rb = b.imdbRating && b.imdbRating !== 'N/A' ? parseFloat(b.imdbRating) : -1;
      return sortDescending ? rb - ra : ra - rb;
    });

    renderGrid(filtered);
    setStatus(`Showing ${filtered.length} of ${currentResults.length} result${currentResults.length === 1 ? '' : 's'}.`);
  }

  async function fetchJson(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error contacting OMDb.');
    return res.json();
  }

  async function performSearch(query){
    if (!query || !query.trim()){
      setStatus('');
      renderEmpty('The house lights are up.', 'Search for a title above to start the screening.');
      currentResults = [];
      return;
    }

    renderLoading();
    setStatus('Searching…');

    try{
      const searchUrl = `${API_BASE}?apikey=${API_KEY}&type=movie&s=${encodeURIComponent(query.trim())}`;
      const data = await fetchJson(searchUrl);

      if (data.Response === 'False'){
        currentResults = [];
        renderEmpty('No reels found.', escapeHtml(data.Error || 'Try a different search term.'));
        setStatus('');
        return;
      }

      const basics = data.Search || [];
      setStatus(`Found ${basics.length} result${basics.length === 1 ? '' : 's'} — fetching ratings…`);

      // Fetch full details (for imdbRating) in parallel, using cache where possible
      const detailed = await Promise.all(basics.map(async (m) => {
        if (detailedCache[m.imdbID]) return detailedCache[m.imdbID];
        try{
          const detailUrl = `${API_BASE}?apikey=${API_KEY}&i=${m.imdbID}`;
          const full = await fetchJson(detailUrl);
          detailedCache[m.imdbID] = full;
          return full;
        }catch(e){
          return m; // fall back to basic info if a detail call fails
        }
      }));

      currentResults = detailed;
      applySortAndFilterAndRender();

    }catch(err){
      console.error(err);
      currentResults = [];
      renderEmpty('Something jammed in the projector.', 'Check your connection and try again.');
      setStatus('Request failed.', true);
    }
  }

  // --- Event wiring ---

  searchBtn.addEventListener('click', () => performSearch(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  });

  ratingSlider.addEventListener('input', () => {
    const v = parseFloat(ratingSlider.value);
    sliderValue.textContent = v <= 0 ? 'Any ≥ 0.0' : `≥ ${v.toFixed(1)}`;
    applySortAndFilterAndRender();
  });

  sortDirBtn.addEventListener('click', () => {
    sortDescending = !sortDescending;
    sortDirText.textContent = sortDescending ? 'Highest first' : 'Lowest first';
    document.getElementById('sortDirIcon').style.transform = sortDescending ? 'scaleY(1)' : 'scaleY(-1)';
    applySortAndFilterAndRender();
  });
