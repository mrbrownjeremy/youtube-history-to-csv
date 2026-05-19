// ==UserScript==
// @name         YouTube - History Page to CSV
// @namespace    https://github.com/mrbrownjeremy
// @version      1.0.0
// @description  Adds a "Download Visible to CSV" button to the YouTube history page
// @author       Jeremy Brown
// @match        https://www.youtube.com/feed/history*
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiNGRjAwMzQiLz4KICA8cGF0aCBkPSJNMzIgMTZWNDAgTTIyIDMwbDEwIDEwIDEwLTEwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIvPgogIDxsaW5lIHgxPSIxNiIgeTE9IjQ4IiB4Mj0iNDgiIHkyPSI0OCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+Cg==
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'yt-history-csv-btn';

  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function normalizeDate(label) {
    const t = label.trim();
    const d = new Date();
    if (/^today$/i.test(t)) return fmt(d);
    if (/^yesterday$/i.test(t)) { d.setDate(d.getDate() - 1); return fmt(d); }
    const p = new Date(t);
    return isNaN(p) ? t : fmt(p);
  }

  function parseViews(str) {
    const m = str.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
    if (!m) return '';
    const n = parseFloat(m[1]);
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2]?.toLowerCase()] ?? 1;
    return Math.round(n * mult);
  }

  function csvField(val) {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function scrapeHistory() {
    const rows = [];
    const sections = document.querySelectorAll('ytd-item-section-renderer');

    for (const section of sections) {
      const dateLabel = section.querySelector('ytd-item-section-header-renderer h2#title')?.textContent?.trim() ?? '';
      const date = dateLabel ? normalizeDate(dateLabel) : '';

      for (const item of section.querySelectorAll('yt-lockup-view-model')) {
        const href = item.querySelector('a.ytLockupViewModelContentImage')?.getAttribute('href') ?? '';
        const videoId = new URLSearchParams(href.split('?')[1] ?? '').get('v') ?? '';
        const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
        const title = item.querySelector('h3[title]')?.getAttribute('title')?.trim() ?? '';
        const duration = item.querySelector('.ytBadgeShapeText')?.textContent?.trim() ?? '';

        const metaSpans = [...item.querySelectorAll('.ytContentMetadataViewModelMetadataRow [role="text"]')];
        const channel = metaSpans[0]?.textContent?.trim() ?? '';
        const rawViews = metaSpans[1]?.textContent?.trim() ?? '';
        const viewsAtCapture = rawViews ? parseViews(rawViews) : '';

        rows.push({ date, title, channel, duration, viewsAtCapture, videoId, url });
      }
    }

    return rows;
  }

  function downloadCSV(rows) {
    const header = ['date', 'title', 'channel', 'duration', 'views_at_capture', 'videoID', 'url'];
    const lines = [
      header.join(','),
      ...rows.map(r => [
        csvField(r.date),
        csvField(r.title),
        csvField(r.channel),
        csvField(r.duration),
        csvField(r.viewsAtCapture),
        csvField(r.videoId),
        csvField(r.url),
      ].join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `yt-history-${fmt(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  function injectButton(container) {
    if (document.getElementById(BUTTON_ID)) return;

    const pauseBtn = container.querySelector('button[aria-label="Pause watch history"]');
    if (!pauseBtn) return;
    const pauseRenderer = pauseBtn.closest('ytd-button-renderer');
    if (!pauseRenderer) return;

    const clone = pauseRenderer.cloneNode(true);
    const cloneBtn = clone.querySelector('button');
    if (!cloneBtn) return;

    cloneBtn.id = BUTTON_ID;
    cloneBtn.setAttribute('aria-label', 'Download visible to CSV');

    const textEl = clone.querySelector('.ytSpecButtonShapeNextButtonTextContent span');
    if (textEl) textEl.textContent = 'Download visible to CSV';

    const iconContainer = clone.querySelector('.ytSpecButtonShapeNextIcon > span > span > div');
    if (iconContainer) {
      iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" aria-hidden="true" style="pointer-events:none;display:inherit;width:100%;height:100%;"><path d="M12 16l-5-5 1.4-1.4 2.6 2.6V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 4v-2h14v2H5z"/></svg>`;
    }

    cloneBtn.addEventListener('click', () => {
      const rows = scrapeHistory();
      if (rows.length === 0) { alert('No history items found.'); return; }
      downloadCSV(rows);
    });

    pauseRenderer.insertAdjacentElement('afterend', clone);
  }

  const observer = new MutationObserver(() => {
    const container = document.querySelector('ytd-browse-feed-actions-renderer #contents');
    if (!container) return;
    const pauseBtn = container.querySelector('button[aria-label="Pause watch history"]');
    if (!pauseBtn) return;
    injectButton(container);
    observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
