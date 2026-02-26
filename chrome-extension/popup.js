const API = 'http://localhost:8000/api';
const root = document.getElementById('root');

// ─── State ────────────────────────────────────────────
let state = {
  view: 'loading',   // loading | offline | empty | list | detail
  videos: [],
  selected: null,    // { video_id, title }
  words: null,       // null | 'loading' | 'no-korean' | 'error' | []
};

// ─── Boot ─────────────────────────────────────────────
(async function init() {
  try {
    const res = await fetch(`${API}/videos/history`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.videos = data.videos || [];
    state.view = state.videos.length ? 'list' : 'empty';
  } catch {
    state.view = 'offline';
  }
  render();
})();

// ─── Render ───────────────────────────────────────────
function render() {
  const { view } = state;
  if      (view === 'loading') root.innerHTML = tmplLoading();
  else if (view === 'offline') root.innerHTML = tmplOffline();
  else if (view === 'empty')   root.innerHTML = tmplEmpty();
  else if (view === 'list')    root.innerHTML = tmplList();
  else if (view === 'detail')  root.innerHTML = tmplDetail();
  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', handleAction);
  });
}

function handleAction(e) {
  const el = e.currentTarget;
  const action = el.dataset.action;

  if (action === 'open-app') {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  }
  if (action === 'back') {
    state.view = 'list';
    state.selected = null;
    state.words = null;
    render();
  }
  if (action === 'get-words') {
    const { id, title } = el.dataset;
    loadWords(id, title);
  }
}

// ─── Load words pipeline ─────────────────────────────
async function loadWords(videoId, title) {
  state.selected = { video_id: videoId, title };
  state.words = 'loading';
  state.view = 'detail';
  render();

  try {
    // Step 1: fetch/cache subtitles
    const subRes = await fetch(`${API}/subtitles/${videoId}`);
    if (!subRes.ok) throw new Error('subtitles');

    // Step 2: vocabulary
    const vocabRes = await fetch(`${API}/vocabulary/${videoId}?level=intermediate&limit=20`);
    if (!vocabRes.ok) throw new Error('vocab');
    const vocab = await vocabRes.json();

    if (!vocab.total_words) {
      state.words = 'no-korean';
      render();
      return;
    }

    // Step 3: flashcard data for English definitions + example sentences
    const wordList = vocab.vocabulary.map(v => v.word);
    const fcRes = await fetch(`${API}/flashcard-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential' }),
    });

    if (fcRes.ok) {
      const fc = await fcRes.json();
      // Merge difficulty from vocab into flashcard data
      state.words = fc.flashcards.map((card, i) => ({
        ...card,
        difficulty: vocab.vocabulary[i]?.difficulty || card.difficulty,
      }));
    } else {
      // Fallback: show words without English
      state.words = vocab.vocabulary.map(v => ({
        target_word: v.word,
        english: null,
        sentence: null,
        sentence_translation: null,
        difficulty: v.difficulty,
      }));
    }
  } catch {
    state.words = 'error';
  }

  render();
}

// ─── Templates ────────────────────────────────────────
function tmplLoading() {
  return `
    ${header({ dot: null, right: '' })}
    <div class="body">
      <div class="center-state">
        <div class="spinner"></div>
        <p class="sub">Connecting to Deadbird...</p>
      </div>
    </div>
  `;
}

function tmplOffline() {
  return `
    ${header({ dot: 'red', right: '<span class="count-badge">Offline</span>' })}
    <div class="body">
      <div class="center-state">
        <div class="icon">⚡</div>
        <p class="title">Backend not running</p>
        <p class="sub">Start the Deadbird server<br>from project-deadbird-backend/new-backend</p>
      </div>
    </div>
  `;
}

function tmplEmpty() {
  return `
    ${header({ dot: 'green', right: '<span class="count-badge">0 videos</span>' })}
    <div class="body">
      <div class="center-state">
        <div class="icon">📺</div>
        <p class="title">No videos tracked yet</p>
        <p class="sub">Watch any Korean video on YouTube — it'll appear here automatically</p>
      </div>
    </div>
    ${footer()}
  `;
}

function tmplList() {
  const { videos } = state;
  const cards = videos.map(v => `
    <div class="video-card">
      <img class="video-thumb"
        src="https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg"
        alt=""
        onerror="this.style.background='#1a1a2a';this.style.border='1px solid rgba(255,255,255,0.06)'"
      >
      <div class="video-meta">
        <div class="video-title-text">${esc(v.title)}</div>
        <div class="video-id-text">${v.video_id}</div>
      </div>
      <button class="words-btn"
        data-action="get-words"
        data-id="${v.video_id}"
        data-title="${esc(v.title)}">
        Words →
      </button>
    </div>
  `).join('');

  return `
    ${header({ dot: 'green', right: `<span class="count-badge">${videos.length} tracked</span>` })}
    <div class="body">
      <div class="video-list">${cards}</div>
    </div>
    ${footer()}
  `;
}

function tmplDetail() {
  const { selected, words } = state;
  let body;

  if (words === 'loading') {
    body = `
      <div class="center-state">
        <div class="spinner"></div>
        <p class="sub">Fetching subtitles & words...</p>
      </div>
    `;
  } else if (words === 'no-korean') {
    body = `
      <div class="center-state">
        <div class="icon">🈚</div>
        <p class="title">No Korean subtitles</p>
        <p class="sub">This video doesn't have Korean captions available</p>
      </div>
    `;
  } else if (words === 'error') {
    body = `
      <div class="center-state">
        <div class="icon">⚠️</div>
        <p class="title">Couldn't load words</p>
        <p class="sub">Check that the backend is running at localhost:8000</p>
      </div>
    `;
  } else if (Array.isArray(words) && !words.length) {
    body = `
      <div class="center-state">
        <div class="icon">🔍</div>
        <p class="title">No words matched</p>
        <p class="sub">No intermediate-level Korean words found in this video</p>
      </div>
    `;
  } else {
    const cards = words.map(w => {
      const eng = w.english && w.english !== 'definition not available'
        ? w.english
        : null;
      const hasSentence = w.sentence && w.sentence_translation;
      return `
        <div class="word-card ${w.difficulty}">
          <div class="word-row">
            <span class="word-korean">${esc(w.target_word)}</span>
            <span class="word-badge">${w.difficulty.replace('_', ' ')}</span>
          </div>
          ${eng ? `<div class="word-english">${esc(eng)}</div>` : ''}
          ${hasSentence ? `
            <div class="word-sentence">
              <div class="ko">${esc(w.sentence)}</div>
              <div class="en">${esc(w.sentence_translation)}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    body = `
      <div class="words-header">${words.length} words found</div>
      <div class="words-list">${cards}</div>
    `;
  }

  return `
    <div class="header">
      <button class="back-btn" data-action="back">← Back</button>
      <span class="detail-title">${esc(selected.title)}</span>
    </div>
    <div class="body">${body}</div>
    ${footer()}
  `;
}

// ─── Helpers ──────────────────────────────────────────
function header({ dot, right }) {
  const dotHtml = dot ? `<span class="status-dot ${dot}"></span>` : '';
  return `
    <div class="header">
      <span class="header-logo">🐦</span>
      <span class="header-title">Deadbird</span>
      <div class="header-right">
        ${right}
        ${dotHtml}
      </div>
    </div>
  `;
}

function footer() {
  return `
    <div class="footer">
      <button class="footer-btn" data-action="open-app">Open Deadbird App →</button>
    </div>
  `;
}

function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
