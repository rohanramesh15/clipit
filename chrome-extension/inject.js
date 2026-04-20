/**
 * Injected into Netflix page to capture subtitles.
 * Uses multiple methods: network interception + DOM observation.
 */
(function() {
  console.log('[ClipIt] Injector v2 starting...');

  // Track what we've already captured
  const capturedUrls = new Set();

  // === Method 1: Intercept fetch ===
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0]?.url || args[0];
    if (url && typeof url === 'string') {
      processResponse(url, response.clone(), 'fetch');
    }
    return response;
  };

  // === Method 2: Intercept XMLHttpRequest ===
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._deadbirdUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      // Only access responseText if responseType allows it ('' or 'text')
      if (this._deadbirdUrl && (this.responseType === '' || this.responseType === 'text')) {
        try {
          if (this.responseText) {
            processText(this._deadbirdUrl, this.responseText, 'xhr');
          }
        } catch (e) {
          // Ignore - responseText not available for this request type
        }
      }
    });
    return originalXHRSend.apply(this, args);
  };

  async function processResponse(url, response, source) {
    try {
      const text = await response.text();
      processText(url, text, source);
    } catch (e) {}
  }

  function processText(url, text, source) {
    if (!text || capturedUrls.has(url)) return;

    // Check if it looks like subtitles
    const isSubtitle = text.includes('WEBVTT') ||
                       text.includes('<tt ') ||
                       text.includes('<tt>') ||
                       text.includes('<?xml') ||
                       (text.includes('<p') && text.includes('begin='));

    if (isSubtitle) {
      capturedUrls.add(url);
      console.log(`[ClipIt] ✓ Subtitle found via ${source}:`, url.substring(0, 80));
      window.postMessage({ type: 'DEADBIRD_SUBTITLE', url: url, text: text }, '*');
    }
  }

  // === Method 3: Monitor for subtitle elements in DOM & trigger screenshot ===
  let lastSubtitleText = '';
  let lastScreenshotRequest = 0;
  const SCREENSHOT_THROTTLE = 3000;
  let debugLogged = false;

  function checkSubtitleElements() {
    // Try multiple selectors for Netflix subtitle container
    const selectors = ['.player-timedtext', '.player-timedtext-text-container', '[data-uia="player-timedtext"]'];
    let subtitleContainer = null;

    for (const sel of selectors) {
      subtitleContainer = document.querySelector(sel);
      if (subtitleContainer) break;
    }

    if (!subtitleContainer) {
      if (!debugLogged) {
        console.log('[ClipIt] ⚠️ No subtitle container found. Looking for:', selectors.join(', '));
        debugLogged = true;
      }
      return;
    }

    const textContent = subtitleContainer.textContent?.trim();
    if (!textContent || textContent === lastSubtitleText) return;

    lastSubtitleText = textContent;
    console.log('[ClipIt] 📝 Subtitle changed:', textContent.substring(0, 50));

    // Request screenshot capture (throttled)
    const now = Date.now();
    if (now - lastScreenshotRequest >= SCREENSHOT_THROTTLE) {
      lastScreenshotRequest = now;

      // Get current video time
      const video = document.querySelector('video');
      const currentTime = video ? Math.floor(video.currentTime) : 0;

      console.log('[ClipIt] 🎯 Requesting screenshot at timestamp:', currentTime);

      // Tell content script to capture screenshot
      window.postMessage({
        type: 'DEADBIRD_CAPTURE_SCREENSHOT',
        timestamp: currentTime,
        text: textContent
      }, '*');
    }
  }

  // Check for subtitle changes frequently
  setInterval(checkSubtitleElements, 500);

  console.log('[ClipIt] Injector v2 ready (fetch + XHR + DOM)');
})();
