// ==UserScript==
// @name         YouTube - History Page to CSV
// @namespace    https://github.com/mrbrownjeremy
// @version      1.2.0
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
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const idx = days.indexOf(t.toLowerCase());
    if (idx !== -1) {
      let daysAgo = (d.getDay() - idx + 7) % 7;
      if (daysAgo === 0) daysAgo = 7;
      d.setDate(d.getDate() - daysAgo);
      return fmt(d);
    }
    const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const m = t.match(/^(\w+)\s+(\d+)(?:,\s*(\d{4}))?$/);
    if (m) {
      const key = m[1].toLowerCase();
      let mIdx = MONTHS.indexOf(key);
      if (mIdx === -1) mIdx = MONTHS_SHORT.indexOf(key);
      if (mIdx !== -1) {
        const today = new Date();
        const year = m[3] ? parseInt(m[3]) : today.getFullYear();
        const p = new Date(year, mIdx, parseInt(m[2]));
        if (!m[3] && p > today) p.setFullYear(p.getFullYear() - 1);
        return fmt(p);
      }
    }
    return t;
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
    const earliest = rows.map(r => r.date).filter(Boolean).sort()[0] ?? '';
    const dateSuffix = earliest ? `--${earliest}` : '';
    a.download = `yt-history-${fmt(new Date())}${dateSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  function makeBtn(text, title) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText = [
      'background:#fff', 'color:#0f0f0f',
      'border:1px solid #d3d3d3', 'border-radius:18px', 'padding:8px 16px',
      'font-family:Roboto,Arial,sans-serif', 'font-size:14px', 'font-weight:500',
      'cursor:pointer', 'box-shadow:0 2px 6px rgba(0,0,0,.15)',
    ].join(';');
    btn.addEventListener('mouseenter', () => { btn.style.background = '#f2f2f2'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; });
    return btn;
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;top:60px;right:24px;z-index:9999;display:flex;gap:8px;align-items:center;';

    const dlBtn = makeBtn('⬇ Download Visible to CSV', 'Download all currently-loaded history items as a CSV');
    dlBtn.id = BUTTON_ID;
    dlBtn.addEventListener('click', () => {
      const rows = scrapeHistory();
      if (rows.length === 0) { alert('No history items found.'); return; }
      downloadCSV(rows);
    });

    const doScroll = () => {
      const el = document.scrollingElement || document.documentElement;
      el.scrollTop = el.scrollHeight;
    };

    const INTERVAL = 3000;

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'position:fixed', 'top:96px', 'right:24px', 'z-index:9999',
      'background:#fff', 'border:1px solid #d3d3d3', 'border-radius:12px',
      'padding:10px 14px', 'font-family:Roboto,Arial,sans-serif', 'font-size:13px',
      'box-shadow:0 2px 6px rgba(0,0,0,.15)', 'display:none', 'min-width:260px',
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    row.innerHTML = '<span>Scroll to Bottom Repeat</span>';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.value = '10';
    input.style.cssText = 'width:52px;padding:4px 6px;border:1px solid #d3d3d3;border-radius:6px;font-size:13px;font-family:inherit;';

    const enterBtn = document.createElement('button');
    enterBtn.textContent = 'Enter';
    enterBtn.style.cssText = [
      'background:#fff', 'border:1px solid #d3d3d3', 'border-radius:8px',
      'padding:4px 10px', 'font-family:Roboto,Arial,sans-serif', 'font-size:13px',
      'cursor:pointer',
    ].join(';');

    const estimate = document.createElement('div');
    estimate.style.cssText = 'margin-top:6px;color:#606060;';

    const updateEstimate = () => {
      const n = Math.max(1, parseInt(input.value) || 1);
      const total = n * INTERVAL / 1000;
      estimate.textContent = `Estimated time: ~${total}s`;
    };
    input.addEventListener('input', updateEstimate);
    updateEstimate();

    row.appendChild(input);
    row.appendChild(enterBtn);
    dialog.appendChild(row);
    dialog.appendChild(estimate);
    document.body.appendChild(dialog);

    const scrollBtn = makeBtn('⏬', 'Scroll to bottom repeatedly to load more history items');
    let scrollTimer = null;

    const stopScroll = () => {
      clearInterval(scrollTimer);
      scrollTimer = null;
      scrollBtn.textContent = '⏬';
      dialog.style.display = 'none';
    };

    const startScroll = () => {
      let remaining = Math.max(1, parseInt(input.value) || 1);
      dialog.style.display = 'none';
      scrollBtn.textContent = '⏹';
      doScroll();
      remaining--;
      if (remaining <= 0) { scrollBtn.textContent = '⏬'; return; }
      scrollTimer = setInterval(() => {
        doScroll();
        remaining--;
        if (remaining <= 0) stopScroll();
      }, INTERVAL);
    };

    enterBtn.addEventListener('click', startScroll);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') startScroll(); });

    scrollBtn.addEventListener('click', () => {
      if (scrollTimer) { stopScroll(); return; }
      dialog.style.display = dialog.style.display === 'none' ? 'block' : 'none';
      if (dialog.style.display === 'block') input.focus();
    });

    wrap.appendChild(dlBtn);
    wrap.appendChild(scrollBtn);
    document.body.appendChild(wrap);
  }

  injectButton();

})();
