(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const form = $('#qr-form');
  const fields = $('#form-fields');
  const tabs = $$('.type-tab');
  const canvas = $('#qr-canvas');
  const emptyState = $('#empty-state');
  const status = $('#preview-status');
  const payloadLabel = $('#payload-label');
  const validation = $('#validation');
  const historyList = $('#history-list');
  const historyEmpty = $('#history-empty');
  const themeToggle = $('#theme-toggle');
  const contrastWarning = $('#contrast-warning');
  const actionMessage = $('#action-message');

  const actionButtons = {
    png: $('#download-png'),
    svg: $('#download-svg'),
    copy: $('#copy-btn'),
    print: $('#print-btn'),
    share: $('#share-btn')
  };

  const storeKey = 'signal-qr-history-v1';
  const themeKey = 'signal-qr-theme';

  const stylePresets = {
    classic: { fg: '#101519', bg: '#ffffff' },
    navy: { fg: '#0b2545', bg: '#eef4f8' },
    forest: { fg: '#134e38', bg: '#edf7f2' },
    sunset: { fg: '#54133b', bg: '#fef1eb' },
    slate: { fg: '#e6edf3', bg: '#161b22' }
  };

  const quickPresets = {
    website: {
      type: 'url',
      values: { url: 'https://example.com' }
    },
    wifi: {
      type: 'wifi',
      values: { ssid: 'Studio Wi-Fi', security: 'WPA', password: 'welcome-home', hidden: false }
    },
    contact: {
      type: 'vcard',
      values: {
        firstName: 'Avery',
        lastName: 'Lee',
        organization: 'North Studio',
        phone: '+1 555 012 3456',
        email: 'avery@example.com',
        website: 'https://example.com'
      }
    },
    event: {
      type: 'event',
      values: {
        title: 'Team Workshop',
        start: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
        end: new Date(Date.now() + 90000000).toISOString().slice(0, 16),
        location: 'Design Studio 4B',
        description: 'Quarterly review & planning session'
      }
    }
  };

  const fieldSets = {
    url: [{ name: 'url', label: 'Website URL', type: 'text', placeholder: 'https://example.com', required: true }],
    text: [{ name: 'text', label: 'Text message', type: 'textarea', placeholder: 'Enter any plain text or message', required: true }],
    wifi: [
      { name: 'ssid', label: 'Network name (SSID)', type: 'text', placeholder: 'My Home Wi-Fi', required: true },
      { name: 'security', label: 'Security encryption', type: 'select', options: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'None (Open)']] },
      { name: 'password', label: 'Wi-Fi Password', type: 'text', placeholder: 'Leave empty for open networks' },
      { name: 'hidden', label: 'Hidden network', type: 'checkbox' }
    ],
    email: [
      { name: 'email', label: 'Recipient email address', type: 'email', placeholder: 'hello@example.com', required: true },
      { name: 'subject', label: 'Email Subject', type: 'text', placeholder: 'Inquiry' },
      { name: 'body', label: 'Email Body', type: 'textarea', placeholder: 'Write your message...' }
    ],
    phone: [{ name: 'phone', label: 'Phone number (international format)', type: 'tel', placeholder: '+1 555 012 3456', required: true }],
    sms: [
      { name: 'phone', label: 'Recipient phone number', type: 'tel', placeholder: '+1 555 012 3456', required: true },
      { name: 'message', label: 'Pre-filled text message', type: 'textarea', placeholder: 'Text message content' }
    ],
    vcard: [
      { name: 'firstName', label: 'First name', type: 'text', placeholder: 'Jane', required: true },
      { name: 'lastName', label: 'Last name', type: 'text', placeholder: 'Doe', required: true },
      { name: 'organization', label: 'Company / Organization', type: 'text', placeholder: 'Acme Corp' },
      { name: 'phone', label: 'Phone number', type: 'tel', placeholder: '+1 555 012 3456' },
      { name: 'email', label: 'Email address', type: 'email', placeholder: 'jane@example.com' },
      { name: 'website', label: 'Website', type: 'text', placeholder: 'https://example.com' }
    ],
    event: [
      { name: 'title', label: 'Event title', type: 'text', placeholder: 'Product Launch Party', required: true },
      { name: 'start', label: 'Start date & time', type: 'datetime-local', required: true },
      { name: 'end', label: 'End date & time', type: 'datetime-local', required: true },
      { name: 'location', label: 'Event location', type: 'text', placeholder: 'Grand Hall / Online link' },
      { name: 'description', label: 'Event description', type: 'textarea', placeholder: 'Agenda and details' }
    ]
  };

  let type = 'url';
  let model = null;
  let currentPayload = '';
  let history = loadHistory();
  let saveTimer = null;
  let isRestoringOrClearing = false;

  // --- Theme Management ---
  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(themeKey);
    } catch {
      // ignore storage access restrictions
    }
    if (!savedTheme) {
      savedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(themeKey, next);
      } catch {
        // ignore
      }
    });
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const isDark = t === 'dark';
    const icon = themeToggle.querySelector('.theme-icon');
    const text = themeToggle.querySelector('.theme-text');
    if (icon) icon.textContent = isDark ? '☼' : '☾';
    if (text) text.textContent = isDark ? 'Light' : 'Dark';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  // --- Field Rendering ---
  function renderFields(values = {}) {
    const items = fieldSets[type] || [];
    fields.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'field-grid';

    for (const item of items) {
      const label = document.createElement('label');
      label.htmlFor = `field-${item.name}`;
      label.textContent = item.label;
      const input = createField(item);
      input.id = `field-${item.name}`;
      input.name = item.name;
      if (item.required) input.required = true;

      if (item.type === 'checkbox') {
        label.className = 'toggle-field';
        label.append(input, Object.assign(document.createElement('span'), { className: 'toggle', ariaHidden: 'true' }));
        input.checked = Boolean(values[item.name]);
      } else {
        label.append(input);
        input.value = values[item.name] ?? '';
        if (item.type === 'textarea' || (['url', 'text', 'email', 'sms', 'event'].includes(type) && item.name === 'body')) {
          label.classList.add('wide');
        }
      }
      grid.append(label);
    }
    fields.append(grid);
    update();
  }

  function createField(item) {
    let input;
    if (item.type === 'textarea') {
      input = document.createElement('textarea');
    } else if (item.type === 'select') {
      input = document.createElement('select');
      item.options.forEach(([value, label]) => input.add(new Option(label, value)));
    } else {
      input = document.createElement('input');
      input.type = item.type;
    }
    if (item.placeholder) input.placeholder = item.placeholder;
    return input;
  }

  function getFormValues() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function escapeVCard(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/:/g, '\\:')
      .replace(/\r?\n/g, '\\n');
  }

  function eventDate(value) {
    return value ? value.replace(/[-:]/g, '').replace('T', 'T') + '00' : '';
  }

  function buildPayload(currentType, v) {
    switch (currentType) {
      case 'url': {
        const raw = v.url?.trim();
        if (!raw) return fail('Please enter a website URL.');
        const formatted = /^(https?:\/\/)/i.test(raw) ? raw : `https://${raw}`;
        try {
          new URL(formatted);
        } catch {
          return fail('Please enter a valid website URL.');
        }
        return ok(formatted);
      }
      case 'text': {
        return v.text?.trim() ? ok(v.text.trim()) : fail('Please enter some text.');
      }
      case 'wifi': {
        if (!v.ssid?.trim()) return fail('Please enter Wi-Fi network SSID name.');
        const esc = (x) => String(x || '').replace(/([\\;,:"])/g, '\\$1');
        const isHidden = $('#field-hidden')?.checked;
        const pass = v.security === 'nopass' ? '' : `P:${esc(v.password)};`;
        return ok(`WIFI:T:${v.security};S:${esc(v.ssid)};${pass}H:${isHidden ? 'true' : 'false'};;`);
      }
      case 'email': {
        if (!v.email?.trim() || !/^\S+@\S+\.\S+$/.test(v.email.trim())) {
          return fail('Please enter a valid recipient email address.');
        }
        const query = new URLSearchParams();
        if (v.subject) query.set('subject', v.subject);
        if (v.body) query.set('body', v.body);
        return ok(`mailto:${v.email.trim()}${query.size ? `?${query.toString()}` : ''}`);
      }
      case 'phone': {
        const clean = v.phone?.trim().replace(/[\s()-]/g, '');
        return clean ? ok(`tel:${clean}`) : fail('Please enter a phone number.');
      }
      case 'sms': {
        const cleanPhone = v.phone?.trim().replace(/[\s()-]/g, '');
        if (!cleanPhone) return fail('Please enter a recipient phone number.');
        return ok(`SMSTO:${cleanPhone}:${v.message || ''}`);
      }
      case 'vcard': {
        if (!v.firstName?.trim() || !v.lastName?.trim()) {
          return fail('Please enter both first and last name.');
        }
        const cardLines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${escapeVCard(v.lastName)};${escapeVCard(v.firstName)};;;`,
          `FN:${escapeVCard(`${v.firstName} ${v.lastName}`.trim())}`,
          v.organization && `ORG:${escapeVCard(v.organization)}`,
          v.phone && `TEL:${escapeVCard(v.phone)}`,
          v.email && `EMAIL:${escapeVCard(v.email)}`,
          v.website && `URL:${escapeVCard(v.website)}`,
          'END:VCARD'
        ].filter(Boolean);
        return ok(cardLines.join('\r\n'));
      }
      case 'event': {
        if (!v.title?.trim() || !v.start || !v.end) {
          return fail('Please provide event title, start time, and end time.');
        }
        if (new Date(v.end) <= new Date(v.start)) {
          return fail('Event end time must be after the start time.');
        }
        const calLines = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//QR Code Generator//EN',
          'BEGIN:VEVENT',
          `SUMMARY:${escapeVCard(v.title)}`,
          `DTSTART:${eventDate(v.start)}`,
          `DTEND:${eventDate(v.end)}`,
          v.location && `LOCATION:${escapeVCard(v.location)}`,
          v.description && `DESCRIPTION:${escapeVCard(v.description)}`,
          'END:VEVENT',
          'END:VCALENDAR'
        ].filter(Boolean);
        return ok(calLines.join('\r\n'));
      }
      default:
        return fail('Unknown QR type.');
    }
  }

  function ok(payload) { return { payload }; }
  function fail(message) { return { message }; }

  function getOptions() {
    return {
      foreground: $('#foreground').value,
      background: $('#background').value,
      size: Number($('#size').value),
      correction: $('#correction').value,
      margin: Number($('#margin').value),
      rounded: $('#rounded').checked
    };
  }

  // --- Contrast Calculation (WCAG luminance) ---
  function getLuminance(hex) {
    const rgb = hex.replace('#', '').match(/.{2}/g);
    if (!rgb || rgb.length < 3) return 0;
    const [r, g, b] = rgb.map((c) => {
      const s = parseInt(c, 16) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getContrastRatio(hex1, hex2) {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function checkContrast(fg, bg) {
    const ratio = getContrastRatio(fg, bg);
    const isLow = ratio < 2.5;
    contrastWarning.hidden = !isLow;
  }

  // --- QR Generation & Render ---
  function update() {
    clearTimeout(saveTimer);
    const result = buildPayload(type, getFormValues());
    validation.textContent = result.message || '';
    if (result.message) return clearPreview();

    const opts = getOptions();
    checkContrast(opts.foreground, opts.background);

    try {
      currentPayload = result.payload;
      model = makeModel(currentPayload, opts.correction);
      paint(model, opts);

      emptyState.classList.add('is-hidden');
      canvas.classList.add('is-visible');
      status.textContent = 'Ready';
      status.classList.add('is-ready');
      payloadLabel.textContent = `${type.toUpperCase()} · ${shortPayload(currentPayload)}`;
      Object.values(actionButtons).forEach((btn) => { btn.disabled = false; });

      if (!isRestoringOrClearing) {
        saveTimer = setTimeout(saveHistory, 600);
      }
    } catch (error) {
      const msg = (error && error.message) || String(error);
      validation.textContent = /Too long|length overflow|length over/.test(msg)
        ? 'Content is too long for this error-correction level. Try shorter text or lower error correction.'
        : 'Could not generate QR code. Content may exceed maximum capacity.';
      clearPreview();
    }
  }

  function clearPreview() {
    clearTimeout(saveTimer);
    saveTimer = null;
    currentPayload = '';
    model = null;
    canvas.classList.remove('is-visible');
    emptyState.classList.remove('is-hidden');
    status.textContent = 'Waiting';
    status.classList.remove('is-ready');
    payloadLabel.textContent = 'No content yet';
    Object.values(actionButtons).forEach((btn) => { btn.disabled = true; });
  }

  function makeModel(payload, correction) {
    const qr = qrcode(0, correction); // typeNumber 0 = auto-select smallest version that fits
    qr.addData(payload);
    qr.make();
    return qr;
  }

  function isFinder(row, col, count) {
    return (row < 8 && col < 8) || (row < 8 && col >= count - 8) || (row >= count - 8 && col < 8);
  }

  function getModuleGeometry(opts, count) {
    const quiet = typeof opts.margin === 'number' ? opts.margin : 4;
    const total = count + quiet * 2;
    const cell = Math.max(1, Math.floor(opts.size / total));
    const size = cell * total;
    return { count, quiet, total, cell, size };
  }

  function paint(qrModel, opts, target = canvas) {
    const geo = getModuleGeometry(opts, qrModel.getModuleCount());
    target.width = target.height = geo.size;
    target.style.width = target.style.height = `${geo.size}px`;
    target.classList.toggle('is-rounded', opts.rounded);

    const ctx = target.getContext('2d');
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, geo.size, geo.size);
    ctx.fillStyle = opts.foreground;

    for (let row = 0; row < geo.count; row += 1) {
      for (let col = 0; col < geo.count; col += 1) {
        if (!qrModel.isDark(row, col)) continue;
        const x = (col + geo.quiet) * geo.cell;
        const y = (row + geo.quiet) * geo.cell;

        if (opts.rounded && !isFinder(row, col, geo.count)) {
          const r = Math.max(1, Math.floor(geo.cell * 0.3));
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, geo.cell, geo.cell, r);
          } else {
            ctx.rect(x, y, geo.cell, geo.cell);
          }
          ctx.fill();
        } else {
          ctx.fillRect(x, y, geo.cell, geo.cell);
        }
      }
    }
  }

  function svgMarkup() {
    const opts = getOptions();
    const geo = getModuleGeometry(opts, model.getModuleCount());
    const rects = [];

    for (let row = 0; row < geo.count; row += 1) {
      for (let col = 0; col < geo.count; col += 1) {
        if (model.isDark(row, col)) {
          const x = (col + geo.quiet) * geo.cell;
          const y = (row + geo.quiet) * geo.cell;
          const round = opts.rounded && !isFinder(row, col, geo.count)
            ? ` rx="${Math.floor(geo.cell * 0.3)}"`
            : '';
          rects.push(`<rect x="${x}" y="${y}" width="${geo.cell}" height="${geo.cell}"${round}/>`);
        }
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${geo.size}" height="${geo.size}" viewBox="0 0 ${geo.size} ${geo.size}" role="img" aria-label="QR code for ${escapeHtml(type)}">
  <rect width="100%" height="100%" fill="${opts.background}"/>
  <g fill="${opts.foreground}">${rects.join('')}</g>
</svg>`;
  }

  // --- Filename helper ---
  function getFilename(ext) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let snippet = type;
    const v = getFormValues();
    if (type === 'url' && v.url) {
      try {
        const u = new URL(/^(https?:\/\/)/i.test(v.url.trim()) ? v.url.trim() : `https://${v.url.trim()}`);
        snippet = u.hostname.replace(/[^a-z0-9]/gi, '_').slice(0, 20);
      } catch {
        snippet = 'url';
      }
    } else if (type === 'wifi' && v.ssid) {
      snippet = `wifi_${v.ssid.trim().replace(/[^a-z0-9]/gi, '_').slice(0, 16)}`;
    } else if (type === 'vcard' && (v.firstName || v.lastName)) {
      snippet = `contact_${(v.firstName + '_' + v.lastName).trim().replace(/[^a-z0-9]/gi, '_').slice(0, 18)}`;
    } else if (type === 'event' && v.title) {
      snippet = `event_${v.title.trim().replace(/[^a-z0-9]/gi, '_').slice(0, 18)}`;
    }
    return `qr_${snippet}_${dateStr}.${ext}`;
  }

  function download(name, url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function setButtonBusy(btn, isBusy, originalText, busyText) {
    if (!btn) return;
    btn.disabled = isBusy;
    btn.textContent = isBusy ? busyText : originalText;
    btn.classList.toggle('is-loading', isBusy);
  }

  function downloadPng() {
    flushHistory();
    const btn = actionButtons.png;
    setButtonBusy(btn, true, 'Download PNG', 'Exporting...');
    try {
      const filename = getFilename('png');
      download(filename, canvas.toDataURL('image/png'));
      showMessage(`Saved ${filename}`, 'success');
    } catch {
      showMessage('Could not generate PNG file.', 'error');
    } finally {
      setTimeout(() => setButtonBusy(btn, false, 'Download PNG'), 400);
    }
  }

  function downloadSvg() {
    flushHistory();
    const btn = actionButtons.svg;
    setButtonBusy(btn, true, 'Download SVG', 'Exporting...');
    try {
      const filename = getFilename('svg');
      const blob = new Blob([svgMarkup()], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      download(filename, url);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showMessage(`Saved ${filename}`, 'success');
    } catch {
      showMessage('Could not generate SVG vector file.', 'error');
    } finally {
      setTimeout(() => setButtonBusy(btn, false, 'Download SVG'), 400);
    }
  }

  async function copyImage() {
    flushHistory();
    const btn = actionButtons.copy;
    setButtonBusy(btn, true, 'Copy Image', 'Copying...');
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error('Clipboard API unavailable');
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Canvas toBlob failed');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showMessage('QR code image copied to clipboard!', 'success');
    } catch {
      showMessage('Copy failed. Your browser may require HTTPS or direct file download.', 'error');
    } finally {
      setTimeout(() => setButtonBusy(btn, false, 'Copy Image'), 400);
    }
  }

  function printCode() {
    flushHistory();
    try {
      const win = window.open('', '_blank');
      if (!win) {
        return showMessage('Please allow pop-ups in your browser to print this code.', 'error');
      }
      const dataUrl = canvas.toDataURL('image/png');
      const safeType = escapeHtml(type);
      const safeDesc = escapeHtml(shortPayload(currentPayload, 120));

      const doc = win.document;
      doc.title = 'Print QR Code · QR Code Generator';
      const style = doc.createElement('style');
      style.textContent = 'body{display:grid;place-items:center;min-height:100vh;margin:0;font-family:Arial,sans-serif;background:#fff;color:#111}main{text-align:center;padding:24px}img{width:min(80vw,420px);height:auto;display:block;margin:0 auto 16px}h2{font-size:18px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em}p{font-size:13px;color:#555;max-width:500px;word-break:break-all;margin:0}';
      doc.head.appendChild(style);

      const main = doc.createElement('main');
      const h2 = doc.createElement('h2');
      h2.textContent = `${safeType} QR Code`;
      const img = doc.createElement('img');
      img.src = dataUrl;
      img.alt = 'QR code';
      const p = doc.createElement('p');
      p.textContent = safeDesc;

      main.append(h2, img, p);
      doc.body.appendChild(main);

      img.onload = () => {
        win.focus();
        win.print();
      };
      showMessage('Print dialog prepared.', 'success');
    } catch {
      showMessage('Could not initiate print dialog.', 'error');
    }
  }

  async function shareCode() {
    flushHistory();
    const btn = actionButtons.share;
    setButtonBusy(btn, true, 'Share', 'Sharing...');
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Blob conversion failed');
      const filename = getFilename('png');
      const file = new File([blob], filename, { type: 'image/png' });
      const dataWithFile = { title: 'QR Code Generator', text: `Scannable ${type} QR Code`, files: [file] };

      if (navigator.canShare && navigator.canShare(dataWithFile)) {
        await navigator.share(dataWithFile);
        showMessage('QR code shared successfully!', 'success');
      } else if (navigator.canShare && navigator.canShare({ title: 'QR Code Generator', text: currentPayload })) {
        await navigator.share({ title: 'QR Code Generator', text: currentPayload });
        showMessage('Shared link/content!', 'success');
      } else {
        showMessage('Direct sharing is not supported on this device. Download PNG instead.', 'error');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showMessage('Sharing failed or was cancelled.', 'error');
      }
    } finally {
      setTimeout(() => setButtonBusy(btn, false, 'Share'), 400);
    }
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }

  function shortPayload(payload, max = 44) {
    if (!payload) return '';
    const clean = payload.replace(/\s+/g, ' ');
    return clean.length > max ? clean.slice(0, max) + '…' : clean;
  }

  function showMessage(text, statusType = 'info') {
    actionMessage.textContent = text;
    actionMessage.className = 'action-message';
    if (statusType === 'error') actionMessage.classList.add('is-error');
    if (statusType === 'success') actionMessage.classList.add('is-success');
    if (text) {
      setTimeout(() => {
        if (actionMessage.textContent === text) {
          actionMessage.textContent = '';
          actionMessage.className = 'action-message';
        }
      }, 4500);
    }
  }

  // --- History Management ---
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(storeKey)) || [];
    } catch {
      return [];
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem(storeKey, JSON.stringify(history));
    } catch {
      showMessage('History storage is unavailable or quota exceeded.', 'error');
    }
  }

  function flushHistory() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveHistory();
  }

  function getHistorySummary(itemType, itemPayload, itemValues) {
    if (itemValues) {
      if (itemType === 'url' && itemValues.url) return itemValues.url;
      if (itemType === 'wifi' && itemValues.ssid) return `SSID: ${itemValues.ssid}`;
      if (itemType === 'vcard' && (itemValues.firstName || itemValues.lastName)) {
        return `${itemValues.firstName || ''} ${itemValues.lastName || ''}`.trim();
      }
      if (itemType === 'event' && itemValues.title) return itemValues.title;
      if (itemType === 'phone' && itemValues.phone) return itemValues.phone;
      if (itemType === 'email' && itemValues.email) return itemValues.email;
      if (itemType === 'sms' && itemValues.phone) return `SMS to ${itemValues.phone}`;
      if (itemType === 'text' && itemValues.text) return itemValues.text;
    }
    return shortPayload(itemPayload, 28);
  }

  function saveHistory() {
    if (!currentPayload || isRestoringOrClearing) return;
    const formVals = getFormValues();
    const opts = getOptions();
    const entryId = `${type}:${currentPayload}:${JSON.stringify(opts)}`;
    const summary = getHistorySummary(type, currentPayload, formVals);

    const entry = {
      id: entryId,
      type,
      payload: currentPayload,
      summary,
      timestamp: Date.now(),
      state: {
        type,
        values: formVals,
        options: opts
      },
      image: canvas.toDataURL('image/png')
    };

    history = [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, 10);
    persistHistory();
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    const hasItems = history.length > 0;
    historyEmpty.classList.toggle('is-hidden', hasItems);
    $('#clear-history').disabled = !hasItems;

    history.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'history-item';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'history-restore';
      restoreBtn.type = 'button';
      restoreBtn.setAttribute('aria-label', `Restore ${entry.type} QR code: ${entry.summary || entry.payload}`);

      const thumb = new Image();
      thumb.src = entry.image;
      thumb.alt = '';
      thumb.className = 'history-thumb';

      const metaWrap = document.createElement('div');
      metaWrap.className = 'history-meta';

      const typeBadge = document.createElement('span');
      typeBadge.className = 'history-badge';
      typeBadge.textContent = (entry.type || 'qr').toUpperCase();

      const desc = document.createElement('span');
      desc.className = 'history-desc';
      desc.textContent = entry.summary || shortPayload(entry.payload, 24);

      metaWrap.append(typeBadge, desc);
      restoreBtn.append(thumb, metaWrap);
      restoreBtn.addEventListener('click', () => restoreHistory(entry));

      const removeBtn = document.createElement('button');
      removeBtn.className = 'history-delete';
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `Delete ${entry.type} history item ${index + 1}`);
      removeBtn.title = 'Remove from history';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        history.splice(index, 1);
        persistHistory();
        renderHistory();
        showMessage('Item removed from history.');
      });

      item.append(restoreBtn, removeBtn);
      historyList.append(item);
    });
  }

  function restoreHistory(entry) {
    isRestoringOrClearing = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    type = entry.state.type;
    tabs.forEach((tab) => {
      const active = tab.dataset.type === type;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    if (entry.state.options) {
      const o = entry.state.options;
      if (o.foreground) $('#foreground').value = o.foreground;
      if (o.background) $('#background').value = o.background;
      if (o.size) $('#size').value = String(o.size);
      if (o.correction) $('#correction').value = o.correction;
      if (typeof o.margin !== 'undefined') $('#margin').value = String(o.margin);
      if (typeof o.rounded !== 'undefined') $('#rounded').checked = Boolean(o.rounded);
    }

    syncOptionLabels();
    renderFields(entry.state.values || {});
    showMessage(`Restored ${entry.type.toUpperCase()} QR code.`, 'info');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { isRestoringOrClearing = false; }, 400);
  }

  function resetAll() {
    isRestoringOrClearing = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    showMessage('');

    type = 'url';
    tabs.forEach((tab) => {
      const active = tab.dataset.type === type;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    resetCustomization(false);
    renderFields({});
    $('#field-url')?.focus();
    showMessage('Form reset.', 'info');
    setTimeout(() => { isRestoringOrClearing = false; }, 300);
  }

  function resetCustomization(showMsg = true) {
    $('#foreground').value = '#101519';
    $('#background').value = '#ffffff';
    $('#size').value = '260';
    $('#correction').value = 'M';
    $('#margin').value = '4';
    $('#rounded').checked = false;
    syncOptionLabels();
    update();
    if (showMsg) showMessage('Customization reset to defaults.', 'info');
  }

  function applyStylePreset(styleName) {
    const p = stylePresets[styleName];
    if (!p) return;
    $('#foreground').value = p.fg;
    $('#background').value = p.bg;
    syncOptionLabels();
    update();
    showMessage(`Applied ${styleName} style.`, 'info');
  }

  function syncOptionLabels() {
    $('#foreground-value').textContent = $('#foreground').value.toUpperCase();
    $('#background-value').textContent = $('#background').value.toUpperCase();
  }

  // --- Event Bindings ---
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      type = tab.dataset.type;
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      renderFields();
    });
  });

  form.addEventListener('input', update);
  form.addEventListener('change', update);

  ['#foreground', '#background', '#size', '#correction', '#margin', '#rounded'].forEach((id) => {
    $(id).addEventListener('input', () => {
      syncOptionLabels();
      update();
    });
  });

  $('#reset-btn').addEventListener('click', resetAll);
  $('#reset-custom-btn').addEventListener('click', () => resetCustomization(true));

  $$('.preset').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = quickPresets[button.dataset.preset];
      if (!preset) return;
      type = preset.type;
      const targetTab = tabs.find((t) => t.dataset.type === type);
      if (targetTab) {
        tabs.forEach((item) => {
          const active = item === targetTab;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-selected', String(active));
        });
      }
      renderFields(preset.values);
      showMessage(`Loaded ${button.dataset.preset} sample preset.`, 'info');
    });
  });

  $$('.style-chip').forEach((btn) => {
    btn.addEventListener('click', () => applyStylePreset(btn.dataset.style));
  });

  actionButtons.png.addEventListener('click', downloadPng);
  actionButtons.svg.addEventListener('click', downloadSvg);
  actionButtons.copy.addEventListener('click', copyImage);
  actionButtons.print.addEventListener('click', printCode);
  actionButtons.share.addEventListener('click', shareCode);

  $('#clear-history').addEventListener('click', () => {
    isRestoringOrClearing = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    history = [];
    persistHistory();
    renderHistory();
    showMessage('History cleared.');
    setTimeout(() => { isRestoringOrClearing = false; }, 300);
  });

  if (navigator.share && navigator.canShare) {
    actionButtons.share.hidden = false;
  }

  // --- Initialize ---
  initTheme();
  syncOptionLabels();
  renderFields();
  renderHistory();
})();
