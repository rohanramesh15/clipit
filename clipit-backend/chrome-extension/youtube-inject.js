/**
 * Injected into YouTube page context to intercept timedtext (subtitle) requests.
 * This captures YouTube's actual working subtitle fetches.
 */
(function() {
  console.log('[ClipIt Interceptor] YouTube timedtext interceptor starting...');

  // Store captured subtitles by URL to avoid duplicates
  const capturedUrls = new Set();

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0]?.url || args[0];

    // Log all fetch requests for debugging
    if (url && typeof url === 'string' && (url.includes('timedtext') || url.includes('caption'))) {
      console.log('[ClipIt Interceptor] Fetch request detected:', url.substring(0, 100));
    }

    const response = await originalFetch.apply(this, args);

    if (url && typeof url === 'string' && url.includes('/api/timedtext')) {
      // Create a unique key for this request (lang + video)
      const langMatch = url.match(/[&?]lang=([^&]+)/);
      const lang = langMatch ? langMatch[1] : 'unknown';
      const videoMatch = url.match(/[&?]v=([^&]+)/);
      const videoId = videoMatch ? videoMatch[1] : 'unknown';
      const uniqueKey = `${videoId}_${lang}`;

      // Skip if we already captured this exact request
      if (capturedUrls.has(uniqueKey)) {
        console.log('[ClipIt Interceptor] Already captured:', uniqueKey);
        return response;
      }

      try {
        const clone = response.clone();
        const text = await clone.text();
        console.log('[ClipIt Interceptor] Timedtext response for', lang, '- length:', text.length);

        if (text && text.length > 10) {
          capturedUrls.add(uniqueKey);
          console.log('[ClipIt Interceptor] Captured timedtext via fetch:', lang, 'length:', text.length);
          window.postMessage({
            type: 'CLIPIT_TIMEDTEXT_CAPTURED',
            lang: lang,
            content: text,
            url: url
          }, '*');
        } else {
          console.log('[ClipIt Interceptor] Empty or very short response for', lang);
        }
      } catch (e) {
        console.log('[ClipIt Interceptor] Error processing fetch:', e.message);
      }
    }
    return response;
  };

  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._clipitUrl = url;
    // Log XHR requests for debugging
    if (url && typeof url === 'string' && (url.includes('timedtext') || url.includes('caption'))) {
      console.log('[ClipIt Interceptor] XHR request detected:', url.substring(0, 100));
    }
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (this._clipitUrl && this._clipitUrl.includes('/api/timedtext')) {
        const langMatch = this._clipitUrl.match(/[&?]lang=([^&]+)/);
        const lang = langMatch ? langMatch[1] : 'unknown';
        const videoMatch = this._clipitUrl.match(/[&?]v=([^&]+)/);
        const videoId = videoMatch ? videoMatch[1] : 'unknown';
        const uniqueKey = `${videoId}_${lang}`;

        // Skip if we already captured this
        if (capturedUrls.has(uniqueKey)) {
          console.log('[ClipIt Interceptor] Already captured via XHR:', uniqueKey);
          return;
        }

        try {
          const text = this.responseText;
          console.log('[ClipIt Interceptor] XHR timedtext response for', lang, '- length:', text.length);

          if (text && text.length > 10) {
            capturedUrls.add(uniqueKey);
            console.log('[ClipIt Interceptor] Captured timedtext via XHR:', lang, 'length:', text.length);
            window.postMessage({
              type: 'CLIPIT_TIMEDTEXT_CAPTURED',
              lang: lang,
              content: text,
              url: this._clipitUrl
            }, '*');
          } else {
            console.log('[ClipIt Interceptor] Empty or very short XHR response for', lang);
          }
        } catch (e) {
          console.log('[ClipIt Interceptor] Error processing XHR:', e.message);
        }
      }
    });
    return originalXHRSend.apply(this, args);
  };

  console.log('[ClipIt Interceptor] YouTube timedtext interceptor installed (fetch + XHR)');
})();
