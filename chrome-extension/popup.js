const API = 'http://localhost:8000/api';
const APP_URL = 'http://localhost:5176';
const root = document.getElementById('root');

// ─── State ────────────────────────────────────────────
let state = {
  view: 'loading',   // loading | offline | empty | list | detail
  videos: [],
  selected: null,    // { video_id, title }
  words: null,       // null | 'loading' | 'no-words' | 'error' | []
  lang: 'ko',        // 'ko' | 'uk'
};

// ─── Boot ─────────────────────────────────────────────
(async function init() {
  // Load persisted language preference
  const stored = await chrome.storage.local.get('language');
  state.lang = stored.language === 'uk' ? 'uk' : 'ko';

  await fetchVideos();
})();

async function fetchVideos() {
  try {
    const res = await fetch(`${API}/videos/history/filtered?lang=${state.lang}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.videos = data.videos || [];
    state.view = state.videos.length ? 'list' : 'empty';
  } catch {
    state.view = 'offline';
  }
  render();
}

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
    chrome.tabs.create({ url: APP_URL });
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
  if (action === 'set-lang') {
    state.lang = el.dataset.lang;
    state.selected = null;
    state.words = null;
    state.view = 'loading';
    chrome.storage.local.set({ language: state.lang }); // fire and forget
    render();
    fetchVideos();
  }
}

// ─── Load words — checks cache first ─────────────────
async function loadWords(videoId, title) {
  const lang = state.lang;
  state.selected = { video_id: videoId, title };
  state.view = 'detail';

  // Check cache first for instant display
  const cacheKey = `vocab_${lang}_${videoId}`;
  const cached = await chrome.storage.local.get(cacheKey);
  const entry = cached[cacheKey];

  if (entry && !entry.loading && !entry.error) {
    state.words = entry.words && entry.words.length ? entry.words : 'no-words';
    render();
    return;
  }

  if (entry && entry.loading) {
    // Pipeline still running in background — show spinner and poll
    state.words = 'loading';
    render();
    pollForResult(videoId, lang);
    return;
  }

  // No cache yet — trigger pipeline and show spinner
  state.words = 'loading';
  render();
  chrome.runtime.sendMessage(
    { type: 'TRACK_VIDEO', videoId, title, lang },
    () => pollForResult(videoId, lang)
  );
}

// Poll chrome.storage until pipeline result is ready
function pollForResult(videoId, lang, attempts = 0) {
  if (attempts > 40) { // 20s timeout
    state.words = 'error';
    render();
    return;
  }
  setTimeout(async () => {
    const cacheKey = `vocab_${lang}_${videoId}`;
    const cached = await chrome.storage.local.get(cacheKey);
    const entry = cached[cacheKey];
    if (entry && !entry.loading) {
      if (entry.error) {
        state.words = 'error';
      } else {
        state.words = entry.words && entry.words.length ? entry.words : 'no-words';
      }
      render();
    } else {
      pollForResult(videoId, lang, attempts + 1);
    }
  }, 500);
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
  const langName = state.lang === 'uk' ? 'Ukrainian' : 'Korean';
  return `
    ${header({ dot: 'green', right: '<span class="count-badge">0 videos</span>' })}
    <div class="body">
      <div class="center-state">
        <div class="icon">📺</div>
        <p class="title">No videos tracked yet</p>
        <p class="sub">Watch any ${langName} video on YouTube — it'll appear here automatically</p>
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
  } else if (words === 'no-words') {
    const langName = state.lang === 'uk' ? 'Ukrainian' : 'Korean';
    body = `
      <div class="center-state">
        <div class="icon">🈚</div>
        <p class="title">No common ${langName} words found</p>
        <p class="sub">No words from this video matched the ${langName} frequency list</p>
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
  } else if (Array.isArray(words)) {
    const cards = words.map(w => {
      const eng = w.english && w.english !== 'definition not available'
        ? w.english
        : null;
      const hasSentence = w.sentence && w.sentence_translation;
      return `
        <div class="word-card">
          <div class="word-row">
            <span class="word-korean">${esc(w.target_word)}</span>
            ${w.rank ? `<span class="word-rank">#${w.rank}</span>` : ''}
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
  } else {
    body = `<div class="center-state"><div class="spinner"></div></div>`;
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
        <div class="lang-toggle">
          <button class="lang-btn ${state.lang === 'ko' ? 'active' : ''}" data-action="set-lang" data-lang="ko">KO</button>
          <button class="lang-btn ${state.lang === 'uk' ? 'active' : ''}" data-action="set-lang" data-lang="uk">UK</button>
        </div>
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
