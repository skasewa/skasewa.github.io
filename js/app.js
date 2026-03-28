// === State ===
let data = null;
let activeCategory = 'all';
let searchQuery = '';
let sortOrder = 'relevance'; // 'relevance' | 'newest' | 'oldest'

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Try fetch first (works on http://) then fall back to inline data (for file://)
    if (window.INLINE_DATA) {
      data = window.INLINE_DATA;
    } else {
      const resp = await fetch('./data/papers.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    }
    computeStats();
    renderOverview();
    renderSidebar();
    bindEvents();
    handleRoute();
  } catch (e) {
    console.error('Failed to load data:', e);
    // If fetch failed, try loading via script tag (file:// fallback)
    if (!window.INLINE_DATA) {
      const script = document.createElement('script');
      script.src = './data/papers.js';
      script.onload = () => {
        if (window.INLINE_DATA) {
          data = window.INLINE_DATA;
          computeStats();
          renderOverview();
          renderSidebar();
          bindEvents();
          handleRoute();
        }
      };
      script.onerror = () => {
        document.getElementById('categories-container').innerHTML =
          '<div class="empty-state">Failed to load data. If opening index.html directly, please use a local server:<br><code>python3 -m http.server 8765</code></div>';
      };
      document.head.appendChild(script);
    }
  }
});

// === Compute Stats ===
function computeStats() {
  let totalPapers = 0;
  let totalAgendas = 0;
  const orgSet = new Set();

  data.categories.forEach(cat => {
    cat.agendas.forEach(agenda => {
      totalAgendas++;
      totalPapers += (agenda.papers || []).length;
      (agenda.organizations || []).forEach(o => orgSet.add(o));
    });
  });

  data.metadata.totalPapers = totalPapers;
  data.metadata.totalAgendas = totalAgendas;
  data.metadata.totalOrgs = orgSet.size;

  const statsEl = document.getElementById('hero-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="hero-stat">
        <div class="number">${totalPapers}+</div>
        <div class="label">Papers & Reports</div>
      </div>
      <div class="hero-stat">
        <div class="number">${totalAgendas}</div>
        <div class="label">Research Agendas</div>
      </div>
      <div class="hero-stat">
        <div class="number">${data.categories.length}</div>
        <div class="label">Categories</div>
      </div>
      <div class="hero-stat">
        <div class="number">${orgSet.size}+</div>
        <div class="label">Organizations</div>
      </div>
    `;
  }
}

// === Category Filter Buttons ===
function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  if (!container) return;

  container.innerHTML = data.categories.map(cat =>
    `<button class="filter-btn" data-category="${escapeAttr(cat.id)}">${cat.icon} ${escapeHtml(cat.name)}</button>`
  ).join('');

  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      // Toggle: if already active, deselect back to "all"
      if (activeCategory === cat) {
        activeCategory = 'all';
        btn.classList.remove('active');
        const allBtn = document.querySelector('.controls .filter-btn[data-category="all"]');
        if (allBtn) allBtn.classList.add('active');
      } else {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = cat;
      }
      renderOverview();
    });
  });
}

// === Render Overview ===
function renderOverview() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  const q = searchQuery.toLowerCase().trim();

  // If searching, show flat paper results; otherwise show category/agenda view
  if (q) {
    renderSearchResults(container, q);
  } else {
    renderCategoryView(container);
  }
}

function renderCategoryView(container) {
  const cats = data.categories.filter(cat =>
    activeCategory === 'all' || cat.id === activeCategory
  );

  if (cats.length === 0) {
    container.innerHTML = '<div class="empty-state">No categories match.</div>';
    return;
  }

  container.innerHTML = cats.map(cat => renderCategory(cat)).join('');
  bindAgendaToggles();
}

function renderSearchResults(container, q) {
  // Collect all papers with full-text search, including descriptions
  const results = [];

  data.categories.forEach(cat => {
    if (activeCategory !== 'all' && cat.id !== activeCategory) return;

    cat.agendas.forEach(agenda => {
      (agenda.papers || []).forEach(paper => {
        const searchableText = [
          paper.title || '',
          (paper.authors || []).join(' '),
          paper.venue || '',
          paper.description || '',
          (paper.tags || []).join(' '),
          agenda.name || '',
          agenda.description || '',
          (agenda.organizations || []).join(' ')
        ].join(' ').toLowerCase();

        if (searchableText.includes(q)) {
          results.push({
            paper,
            agendaName: agenda.name,
            agendaId: agenda.id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            categoryId: cat.id
          });
        }
      });
    });
  });

  // Sort results
  if (sortOrder === 'newest') {
    results.sort((a, b) => (b.paper.year || 0) - (a.paper.year || 0));
  } else if (sortOrder === 'oldest') {
    results.sort((a, b) => (a.paper.year || 0) - (b.paper.year || 0));
  }
  // 'relevance' keeps insertion order (category order)

  if (results.length === 0) {
    container.innerHTML = '<div class="empty-state">No papers match your search.</div>';
    return;
  }

  container.innerHTML = `
    <div class="search-results-header">
      <span class="search-results-count">${results.length} result${results.length !== 1 ? 's' : ''}</span>
      <div class="sort-controls">
        <label for="sort-select" class="sr-only">Sort results</label>
        <select id="sort-select" class="sort-select">
          <option value="relevance" ${sortOrder === 'relevance' ? 'selected' : ''}>Category order</option>
          <option value="newest" ${sortOrder === 'newest' ? 'selected' : ''}>Newest first</option>
          <option value="oldest" ${sortOrder === 'oldest' ? 'selected' : ''}>Oldest first</option>
        </select>
      </div>
    </div>
    <div class="search-results-list">
      ${results.map(r => renderSearchPaper(r)).join('')}
    </div>
  `;

  // Bind sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortOrder = e.target.value;
      renderOverview();
    });
  }
}

function renderSearchPaper(result) {
  const { paper, agendaName, agendaId, categoryName, categoryIcon, categoryId } = result;
  const authors = (paper.authors || []).filter(a => a !== 'et al.');
  const authorsStr = authors.length > 4
    ? authors.slice(0, 4).join(', ') + ', et al.'
    : authors.join(', ');

  const titleHtml = paper.url
    ? `<a href="${escapeAttr(paper.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.title || 'Untitled')}</a>`
    : escapeHtml(paper.title || 'Untitled');

  return `
    <div class="paper search-paper">
      <span class="paper-year">${paper.year || '?'}</span>
      <div class="paper-info">
        <div class="paper-title">${titleHtml}</div>
        <div class="paper-authors">${escapeHtml(authorsStr)}</div>
        <div class="paper-venue">${escapeHtml(paper.venue || '')}</div>
        ${paper.description ? `<div class="paper-description">${escapeHtml(paper.description)}</div>` : ''}
        <div class="paper-meta-row">
          <span class="paper-breadcrumb">${categoryIcon} ${escapeHtml(categoryName)} &rarr; <a href="#agenda/${escapeAttr(categoryId)}/${escapeAttr(agendaId)}">${escapeHtml(agendaName)}</a></span>
          <div class="paper-tags">
            ${(paper.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCategory(cat) {
  const paperCount = cat.agendas.reduce((sum, a) => sum + (a.papers || []).length, 0);

  // Sort agendas by paper count
  const sortedAgendas = [...cat.agendas];
  if (sortOrder === 'newest' || sortOrder === 'oldest') {
    // No agenda-level sort in category view
  }

  return `
    <section class="category" id="cat-${escapeAttr(cat.id)}">
      <div class="category-header">
        <span class="category-icon">${cat.icon}</span>
        <h2 class="category-title">${escapeHtml(cat.name)}</h2>
        <span class="category-count">${cat.agendas.length} agendas &middot; ${paperCount} papers</span>
      </div>
      <p class="category-desc">${escapeHtml(cat.description)}</p>
      ${sortedAgendas.map(a => renderAgenda(a, cat)).join('')}
    </section>
  `;
}

function renderAgenda(agenda, cat) {
  let papers = agenda.papers || [];

  // Sort papers if requested
  if (sortOrder === 'newest') {
    papers = [...papers].sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (sortOrder === 'oldest') {
    papers = [...papers].sort((a, b) => (a.year || 0) - (b.year || 0));
  }

  const papersHtml = papers.length > 0
    ? `<div class="papers-list">${papers.map(renderPaper).join('')}</div>`
    : '<div class="papers-list"><p class="empty-state" style="padding:16px;font-size:0.8rem;">Papers to be added. Contributions welcome.</p></div>';

  const agendaLink = cat ? `#agenda/${escapeAttr(cat.id)}/${escapeAttr(agenda.id)}` : '#overview';

  return `
    <div class="agenda" data-agenda-id="${escapeAttr(agenda.id)}">
      <div class="agenda-header" role="button" tabindex="0" aria-expanded="false">
        <div>
          <div class="agenda-name">
            <a href="${agendaLink}" class="agenda-link">${escapeHtml(agenda.name)}</a>
          </div>
          <div class="agenda-orgs">
            ${(agenda.organizations || []).map(o => `<span class="org-badge">${escapeHtml(o)}</span>`).join('')}
          </div>
          <p class="agenda-desc">${escapeHtml(agenda.description)}</p>
        </div>
        <span class="agenda-toggle" aria-hidden="true">&#9662;</span>
      </div>
      <div class="agenda-body">
        ${papersHtml}
      </div>
    </div>
  `;
}

function renderPaper(paper) {
  const authors = (paper.authors || []).filter(a => a !== 'et al.');
  const authorsStr = authors.length > 3
    ? authors.slice(0, 3).join(', ') + ', et al.'
    : authors.join(', ');

  const titleHtml = paper.url
    ? `<a href="${escapeAttr(paper.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.title || 'Untitled')}</a>`
    : escapeHtml(paper.title || 'Untitled');

  return `
    <div class="paper">
      <span class="paper-year">${paper.year || '?'}</span>
      <div class="paper-info">
        <div class="paper-title">${titleHtml}</div>
        <div class="paper-authors">${escapeHtml(authorsStr)}</div>
        <div class="paper-venue">${escapeHtml(paper.venue || '')}</div>
        ${paper.description ? `<div class="paper-description">${escapeHtml(paper.description)}</div>` : ''}
        <div class="paper-tags">
          ${(paper.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// === Agenda Page ===
function renderAgendaPage(categoryId, agendaId) {
  const cat = data.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const agenda = cat.agendas.find(a => a.id === agendaId);
  if (!agenda) return;

  let papers = agenda.papers || [];
  if (sortOrder === 'newest') {
    papers = [...papers].sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (sortOrder === 'oldest') {
    papers = [...papers].sort((a, b) => (a.year || 0) - (b.year || 0));
  }

  const agendaPage = document.getElementById('page-agenda');
  if (!agendaPage) return;

  // Rich content sections
  const hasRichContent = agenda.research_direction || agenda.theory_of_change || agenda.progress || agenda.open_problems;

  const richContentHtml = hasRichContent ? `
    <div class="agenda-rich-content">
      ${agenda.research_direction ? `
        <div class="agenda-section">
          <h3 class="agenda-section-title">Research Direction</h3>
          <p>${renderLinkedText(agenda.research_direction)}</p>
        </div>
      ` : ''}
      ${agenda.theory_of_change ? `
        <div class="agenda-section">
          <h3 class="agenda-section-title">Theory of Change</h3>
          <p>${renderLinkedText(agenda.theory_of_change)}</p>
        </div>
      ` : ''}
      ${agenda.progress ? `
        <div class="agenda-section">
          <h3 class="agenda-section-title">Current Progress</h3>
          <p>${renderLinkedText(agenda.progress)}</p>
        </div>
      ` : ''}
      ${agenda.open_problems && agenda.open_problems.length > 0 ? `
        <div class="agenda-section">
          <h3 class="agenda-section-title">Open Problems</h3>
          <div class="agenda-open-problems">
            ${agenda.open_problems.map(p => {
              // Support both old format (string) and new format (object)
              if (typeof p === 'string') {
                return `<div class="open-problem"><div class="op-question">${escapeHtml(p)}</div></div>`;
              }
              const quality = p.quality || '';
              const qualityClass = quality === 'STRONG' ? 'op-strong' : quality === 'PARTIAL' ? 'op-partial' : 'op-weak';
              return `
                <div class="open-problem">
                  <div class="op-question">${escapeHtml(p.problem || '')}</div>
                  ${p.best_answer ? `
                    <div class="op-answer">
                      <span class="op-label">Best current answer</span>
                      <span class="op-quality ${qualityClass}">${escapeHtml(quality)}</span>
                      <p>${renderLinkedText(p.best_answer)}</p>
                    </div>
                  ` : ''}
                  ${p.source ? `
                    <div class="op-source">
                      ${p.source_url
                        ? `<a href="${escapeAttr(p.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.source)}</a>`
                        : escapeHtml(p.source)}
                    </div>
                  ` : ''}
                  ${p.critique ? `
                    <div class="op-critique">${renderLinkedText(p.critique)}</div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  ` : '';

  agendaPage.innerHTML = `
    <div class="container">
      <div class="agenda-page">
        <div class="agenda-page-nav">
          <a href="#overview">&larr; Back to overview</a>
        </div>
        <div class="agenda-page-header">
          <span class="category-icon">${cat.icon}</span>
          <div>
            <div class="agenda-page-breadcrumb">${escapeHtml(cat.name)}</div>
            <h2 class="agenda-page-title">${escapeHtml(agenda.name)}</h2>
          </div>
        </div>
        <div class="agenda-page-orgs">
          ${(agenda.organizations || []).map(o => `<span class="org-badge">${escapeHtml(o)}</span>`).join('')}
        </div>
        ${richContentHtml}
        <div class="agenda-page-controls">
          <h3 class="agenda-section-title" style="margin:0;">Papers & Reports</h3>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="search-results-count">${papers.length} paper${papers.length !== 1 ? 's' : ''}</span>
            <div class="sort-controls">
              <label for="agenda-sort-select" class="sr-only">Sort papers</label>
              <select id="agenda-sort-select" class="sort-select">
                <option value="relevance" ${sortOrder === 'relevance' ? 'selected' : ''}>Default order</option>
                <option value="newest" ${sortOrder === 'newest' ? 'selected' : ''}>Newest first</option>
                <option value="oldest" ${sortOrder === 'oldest' ? 'selected' : ''}>Oldest first</option>
              </select>
            </div>
          </div>
        </div>
        <div class="papers-list agenda-page-papers">
          ${papers.length > 0
            ? papers.map(renderPaper).join('')
            : '<p class="empty-state" style="padding:16px;">Papers to be added. Contributions welcome.</p>'}
        </div>
      </div>
    </div>
  `;

  const sortSelect = document.getElementById('agenda-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortOrder = e.target.value;
      renderAgendaPage(categoryId, agendaId);
    });
  }

  showPage('agenda');
}

// === Agendas Index Page ===
function renderAgendasIndex() {
  const container = document.getElementById('agendas-index');
  if (!container) return;

  container.innerHTML = `
    <div class="agendas-hero">
      <h1>Research Agendas</h1>
      <p class="agendas-hero-sub">${data.metadata.totalAgendas || data.categories.reduce((s, c) => s + c.agendas.length, 0)} research agendas across ${data.categories.length} categories. Each agenda describes a distinct line of governance research — its direction, theory of change, progress, and open problems.</p>
    </div>
    ${data.categories.map(cat => {
      return `
        <div class="agendas-category">
          <div class="agendas-category-header">
            <span class="category-icon">${cat.icon}</span>
            <h2>${escapeHtml(cat.name)}</h2>
          </div>
          <div class="agendas-grid">
            ${cat.agendas.map(a => {
              const paperCount = (a.papers || []).length;
              const problemCount = (a.open_problems || []).length;
              return `
                <a href="#agenda/${escapeAttr(cat.id)}/${escapeAttr(a.id)}" class="agenda-card">
                  <div class="agenda-card-name">${escapeHtml(a.name)}</div>
                  <p class="agenda-card-desc">${escapeHtml(a.research_direction ? a.research_direction.substring(0, 180) + '...' : a.description)}</p>
                  <div class="agenda-card-meta">
                    <span>${paperCount} paper${paperCount !== 1 ? 's' : ''}</span>
                    <span>${problemCount} open problem${problemCount !== 1 ? 's' : ''}</span>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

// === Sidebar ===
function renderSidebar() {
  const sidebar = document.getElementById('sidebar-links');
  if (!sidebar) return;

  sidebar.innerHTML = data.categories.map(cat => `
    <li>
      <a href="#cat-${escapeAttr(cat.id)}" class="sidebar-cat-link" data-cat-id="${escapeAttr(cat.id)}">
        <span class="cat-icon">${cat.icon}</span>
        ${escapeHtml(cat.name)}
      </a>
    </li>
  `).join('');

  sidebar.querySelectorAll('.sidebar-cat-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const catId = link.dataset.catId;
      const target = document.getElementById(`cat-${catId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// === Agenda Toggle ===
function bindAgendaToggles() {
  document.querySelectorAll('.agenda-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking the agenda link
      if (e.target.closest('.agenda-link')) return;
      toggleAgenda(header);
    });
    header.addEventListener('keydown', (e) => {
      if (e.target.closest('.agenda-link')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleAgenda(header);
      }
    });
  });
}

function toggleAgenda(headerEl) {
  const agenda = headerEl.closest('.agenda');
  const isOpen = agenda.classList.toggle('open');
  headerEl.setAttribute('aria-expanded', isOpen);
}

// === Events ===
function bindEvents() {
  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchQuery = e.target.value;
        renderOverview();
      }, 200);
    });
  }

  // Sort select (in controls bar)
  const mainSort = document.getElementById('main-sort-select');
  if (mainSort) {
    mainSort.addEventListener('change', (e) => {
      sortOrder = e.target.value;
      renderOverview();
    });
  }

  // "All" filter button
  const allBtn = document.querySelector('.controls .filter-btn[data-category="all"]');
  if (allBtn) {
    allBtn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      activeCategory = 'all';
      renderOverview();
    });
  }

  // Nav links
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page === 'agendas' && data) renderAgendasIndex();
      showPage(page);
      history.pushState(null, '', `#${page}`);
    });
  });
}

// === Pages ===
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });

  window.scrollTo(0, 0);
}

function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'overview';

  // Agenda page route: #agenda/categoryId/agendaId
  if (hash.startsWith('agenda/')) {
    const parts = hash.split('/');
    if (parts.length === 3 && data) {
      renderAgendaPage(parts[1], parts[2]);
      return;
    }
  }

  if (['overview', 'agendas', 'methodology', 'about'].includes(hash)) {
    if (hash === 'agendas' && data) renderAgendasIndex();
    showPage(hash);
  } else {
    showPage('overview');
  }
}

window.addEventListener('hashchange', handleRoute);

// === Utils ===
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Render text that may contain [link text](url) markdown-style links
function renderLinkedText(str) {
  if (typeof str !== 'string') return '';
  // First escape the whole string, then convert markdown links
  const escaped = escapeHtml(str);
  // Match [text](url) — the escaped version will have &amp; etc in URLs
  return escaped.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
