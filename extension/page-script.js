/**
 * MAIN world: captures X session headers and resolves AboutAccountQuery.
 * Detection technique adapted from xaitax/x-account-location-device (MIT).
 */
(function () {
  'use strict';
  if (window.__X_COUNTRY_DETECT__) return;
  window.__X_COUNTRY_DETECT__ = true;

  const API_PATTERN = /x\.com\/i\/api\/graphql/;
  const ABOUT_QUERY_ID = 'XRqGa7EeokUU5kppkh13EA';

  let headersCaptured = false;
  let capturedHeaders = null;

  function hasHeader(headers, name) {
    if (headers instanceof Headers) return headers.has(name);
    const wanted = name.toLowerCase();
    return Object.keys(headers || {}).some(k => k.toLowerCase() === wanted);
  }

  function sendHeaders(headers) {
    if (headersCaptured) return;
    if (!hasHeader(headers, 'authorization') || !hasHeader(headers, 'x-csrf-token')) return;

    headersCaptured = true;
    const headerObj =
      headers instanceof Headers ? Object.fromEntries(headers.entries()) : { ...headers };
    capturedHeaders = headerObj;

    window.dispatchEvent(
      new CustomEvent('xcd-headers-captured', {
        detail: JSON.stringify({ headers: headerObj })
      })
    );
  }

  window.addEventListener('xcd-reset-headers', () => {
    headersCaptured = false;
    capturedHeaders = null;
  });

  function parseAboutAccount(data) {
    const user = data?.data?.user_result_by_screen_name?.result;
    const profile = user?.about_profile;
    return {
      location: profile?.account_based_in || null,
      locationAccurate: profile?.location_accurate !== false
    };
  }

  window.addEventListener('xcd-fetch-user', async event => {
    let request = {};
    try {
      request = JSON.parse(event.detail || '{}');
    } catch {
      request = {};
    }
    const { id, screenName } = request;

    try {
      if (!id || !screenName || !capturedHeaders) {
        throw new Error('No captured page headers');
      }

      const variables = encodeURIComponent(JSON.stringify({ screenName }));
      const url = `/i/api/graphql/${ABOUT_QUERY_ID}/AboutAccountQuery?variables=${variables}`;
      const response = await fetch(url, {
        headers: {
          ...capturedHeaders,
          'accept-language': 'en-US,en;q=0.9'
        },
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          headersCaptured = false;
          capturedHeaders = null;
          window.dispatchEvent(
            new CustomEvent('xcd-fetch-user-result', {
              detail: JSON.stringify({
                id,
                success: false,
                error: 'Authentication failed',
                code: 'UNAUTHORIZED'
              })
            })
          );
          return;
        }
        throw new Error(`Page API error: ${response.status}`);
      }

      window.dispatchEvent(
        new CustomEvent('xcd-fetch-user-result', {
          detail: JSON.stringify({
            id,
            success: true,
            data: parseAboutAccount(await response.json())
          })
        })
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('xcd-fetch-user-result', {
          detail: JSON.stringify({
            id,
            success: false,
            error: error?.message || String(error)
          })
        })
      );
    }
  });

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && API_PATTERN.test(url) && init?.headers) sendHeaders(init.headers);
    } catch (_) {}
    return originalFetch.apply(this, arguments);
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this._xcdUrl = url;
      this._xcdHeaders = {};
    } catch (_) {}
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (this._xcdHeaders) this._xcdHeaders[name] = value;
    } catch (_) {}
    return originalXHRSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    try {
      if (this._xcdUrl && API_PATTERN.test(this._xcdUrl) && this._xcdHeaders) {
        sendHeaders(this._xcdHeaders);
      }
    } catch (_) {}
    return originalXHRSend.apply(this, arguments);
  };
})();
