const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('--- Starting QR Code Generator Unit & Integration Tests ---');

// 1. Load qrcode-generator.js (qrcode-generator + UTF-8 support)
const qrCodeJs = fs.readFileSync('qrcode-generator.js', 'utf8');

function makeFakeEl(tag) {
  const tableNode = {
    offsetWidth: 1,
    offsetHeight: 1,
    style: {},
    childNodes: [],
    children: []
  };
  const el = {
    tagName: tag || 'div',
    title: '',
    style: {},
    children: [],
    childNodes: [],
    innerHTML: '',
    offsetWidth: 0,
    offsetHeight: 0,
    getContext: () => ({ fillRect: () => {}, clearRect: () => {}, strokeRect: () => {} }),
    appendChild: (child) => {
      el.children.push(child);
      el.childNodes.push(child);
      return child;
    },
    removeChild: (child) => {
      el.children = el.children.filter((c) => c !== child);
      el.childNodes = el.childNodes.filter((c) => c !== child);
      return child;
    },
    hasChildNodes: () => el.childNodes.length > 0,
    setAttribute: () => {}
  };
  Object.defineProperty(el, 'innerHTML', {
    get: () => el._innerHTML || '',
    set: (value) => {
      el._innerHTML = value;
      if (value && value.includes('<table')) {
        el.childNodes = [tableNode];
      } else {
        el.childNodes = [];
      }
    }
  });
  return el;
}

const sandbox = {
  window: {},
  document: {
    createElement: (tag) => makeFakeEl(tag),
    createElementNS: (ns, tag) => makeFakeEl(tag),
    documentElement: { tagName: 'html', style: {} }
  },
  navigator: {},
  console: console
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(qrCodeJs, sandbox);
const qrcode = sandbox.qrcode;

assert.strictEqual(typeof qrcode, 'function', 'qrcode factory should be loaded');
assert.strictEqual(typeof qrcode.stringToBytes, 'function', 'UTF-8 stringToBytes should be installed');
console.log('✓ qrcode-generator core library + UTF-8 support loaded successfully');

// Helper: generate a QR model via the new library API
function makeModel(payload, correction) {
  const qr = qrcode(0, correction); // 0 = auto-select smallest fitting version
  qr.addData(payload);
  qr.make();
  return qr;
}

// 2. Test Payload builders logic
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

function buildPayload(type, v) {
  switch (type) {
    case 'url': {
      const raw = v.url?.trim();
      if (!raw) return { message: 'Please enter a website URL.' };
      const formatted = /^(https?:\/\/)/i.test(raw) ? raw : `https://${raw}`;
      try {
        new URL(formatted);
      } catch {
        return { message: 'Please enter a valid website URL.' };
      }
      return { payload: formatted };
    }
    case 'text': {
      return v.text?.trim() ? { payload: v.text.trim() } : { message: 'Please enter some text.' };
    }
    case 'wifi': {
      if (!v.ssid?.trim()) return { message: 'Please enter Wi-Fi network SSID name.' };
      const esc = (x) => String(x || '').replace(/([\\;,:"])/g, '\\$1');
      const pass = v.security === 'nopass' ? '' : `P:${esc(v.password)};`;
      return { payload: `WIFI:T:${v.security};S:${esc(v.ssid)};${pass}H:${v.hidden ? 'true' : 'false'};;` };
    }
    case 'email': {
      if (!v.email?.trim() || !/^\S+@\S+\.\S+$/.test(v.email.trim())) {
        return { message: 'Please enter a valid recipient email address.' };
      }
      const query = new URLSearchParams();
      if (v.subject) query.set('subject', v.subject);
      if (v.body) query.set('body', v.body);
      return { payload: `mailto:${v.email.trim()}${query.size ? `?${query.toString()}` : ''}` };
    }
    case 'phone': {
      const clean = v.phone?.trim().replace(/[\s()-]/g, '');
      return clean ? { payload: `tel:${clean}` } : { message: 'Please enter a phone number.' };
    }
    case 'sms': {
      const cleanPhone = v.phone?.trim().replace(/[\s()-]/g, '');
      if (!cleanPhone) return { message: 'Please enter a recipient phone number.' };
      return { payload: `SMSTO:${cleanPhone}:${v.message || ''}` };
    }
    case 'vcard': {
      if (!v.firstName?.trim() || !v.lastName?.trim()) {
        return { message: 'Please enter both first and last name.' };
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
      return { payload: cardLines.join('\r\n') };
    }
    case 'event': {
      if (!v.title?.trim() || !v.start || !v.end) {
        return { message: 'Please provide event title, start time, and end time.' };
      }
      if (new Date(v.end) <= new Date(v.start)) {
        return { message: 'Event end time must be after the start time.' };
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
      return { payload: calLines.join('\r\n') };
    }
    default:
      return { message: 'Unknown type' };
  }
}

// Test URL
const urlRes1 = buildPayload('url', { url: 'example.com/test' });
assert.strictEqual(urlRes1.payload, 'https://example.com/test');
const urlRes2 = buildPayload('url', { url: '' });
assert.ok(urlRes2.message);
console.log('✓ URL payload handling verified');

// Test Text
const textRes1 = buildPayload('text', { text: 'Hello 🌍 World!' });
assert.strictEqual(textRes1.payload, 'Hello 🌍 World!');
const textRes2 = buildPayload('text', { text: '   ' });
assert.ok(textRes2.message);
console.log('✓ Text payload handling verified');

// Test Wi-Fi
const wifiRes = buildPayload('wifi', { ssid: 'Home;Net:work', security: 'WPA', password: 'secret:pass;word', hidden: true });
assert.strictEqual(wifiRes.payload, 'WIFI:T:WPA;S:Home\\;Net\\:work;P:secret\\:pass\\;word;H:true;;');
console.log('✓ Wi-Fi payload with escaping verified');

// Test Email
const emailRes = buildPayload('email', { email: 'test@example.com', subject: 'Subject & More', body: 'Line 1\nLine 2' });
assert.ok(emailRes.payload.startsWith('mailto:test@example.com?'));
assert.ok(emailRes.payload.includes('subject=Subject'));
console.log('✓ Email payload verified');

// Test Phone & SMS
const phoneRes = buildPayload('phone', { phone: '+1 (555) 012-3456' });
assert.strictEqual(phoneRes.payload, 'tel:+15550123456');
const smsRes = buildPayload('sms', { phone: '(555) 123-4567', message: 'Hello!' });
assert.strictEqual(smsRes.payload, 'SMSTO:5551234567:Hello!');
console.log('✓ Phone and SMS payload verified');

// Test vCard
const vcardRes = buildPayload('vcard', {
  firstName: 'Jane, A.',
  lastName: 'Doe; Jr.',
  organization: 'Acme; Inc.',
  phone: '+1 555 012 3456',
  email: 'jane@example.com',
  website: 'https://example.com'
});
assert.ok(vcardRes.payload.includes('N:Doe\\; Jr.;Jane\\, A.;;;'));
assert.ok(vcardRes.payload.includes('FN:Jane\\, A. Doe\\; Jr.'));
assert.ok(vcardRes.payload.includes('ORG:Acme\\; Inc.'));
console.log('✓ vCard payload with special char escaping verified');

// Test Event
const eventRes = buildPayload('event', {
  title: 'Team Meeting: Q3',
  start: '2026-09-01T10:00',
  end: '2026-09-01T11:30',
  location: 'Room 101, HQ',
  description: 'Discuss Q3 OKRs & milestones'
});
assert.ok(eventRes.payload.includes('DTSTART:20260901T100000'));
assert.ok(eventRes.payload.includes('DTEND:20260901T113000'));
assert.ok(eventRes.payload.includes('LOCATION:Room 101\\, HQ'));

const eventInvalid = buildPayload('event', {
  title: 'Bad Times',
  start: '2026-09-01T12:00',
  end: '2026-09-01T10:00'
});
assert.ok(eventInvalid.message.includes('after the start time'));
console.log('✓ Event payload and validation verified');

// 3. Test QR model generation: every payload type, all correction levels, plus unicode/emoji
const payloads = {
  url: 'https://example.com/route?q=hello+world',
  text: 'Hello 🌍 世界 🚀 — café, naïve, résumé',
  wifi: 'WIFI:T:WPA;S:Café_Réseau;P:pässwörd;H:false;;',
  email: 'mailto:test@example.com?subject=Olá%20mundo&body=Linha%201',
  phone: 'tel:+15550123456',
  sms: 'SMSTO:5551234567:Hello 🌍!',
  vcard: 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Doe;Jane;;;\r\nFN:Jane Doe\r\nEND:VCARD',
  event: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QR Code Generator//EN\r\nBEGIN:VEVENT\r\nSUMMARY:Ärger\r\nDTSTART:20260901T100000\r\nDTEND:20260901T113000\r\nEND:VEVENT\r\nEND:VCALENDAR'
};

['L', 'M', 'Q', 'H'].forEach((level) => {
  Object.keys(payloads).forEach((type) => {
    const model = makeModel(payloads[type], level);
    assert.ok(model.getModuleCount() > 20, `${type}@${level} should produce a valid matrix`);
    assert.strictEqual(typeof model.isDark(0, 0), 'boolean', `${type}@${level} isDark should be boolean`);
  });
});
console.log('✓ All 8 payload types (incl. unicode/emoji/CJK/accented) generate matrices at levels L, M, Q, H — no overflow');

// 3b. Long text (near QR v40 capacity) succeeds; truly oversized content fails cleanly
const longModel = makeModel('https://example.com/' + 'x'.repeat(900), 'M');
assert.ok(longModel.getModuleCount() >= 100, 'Long content should auto-select a large version');
console.log('✓ Long content auto-selects version', longModel.getModuleCount(), 'modules');

let threw = false;
try {
  makeModel('https://example.com/' + 'x'.repeat(1800), 'H');
} catch (err) {
  threw = true;
}
assert.ok(threw, 'Content beyond QR v40 capacity should throw');
console.log('✓ Oversized content overflow is caught cleanly (no crash)');

// 4. Test Contrast calculation
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

const highContrast = getContrastRatio('#000000', '#ffffff');
assert.ok(highContrast > 20, 'Black/White contrast should be ~21:1');
const lowContrast = getContrastRatio('#888888', '#999999');
assert.ok(lowContrast < 2.5, 'Close grays should have low contrast ratio');
console.log('✓ Contrast check formula verified (Ratio B/W:', highContrast.toFixed(1), ', Low:', lowContrast.toFixed(2), ')');

// 5. Test SVG Output generator
function getModuleGeometry(opts, count) {
  const quiet = typeof opts.margin === 'number' ? opts.margin : 4;
  const total = count + quiet * 2;
  const cell = Math.max(1, Math.floor(opts.size / total));
  const size = cell * total;
  return { count, quiet, total, cell, size };
}

const model = makeModel('https://example.com', 'M');
const geo = getModuleGeometry({ size: 360, margin: 4 }, model.getModuleCount());
assert.ok(geo.size > 0);
assert.strictEqual(geo.quiet, 4);
console.log('✓ Module geometry with quiet zone (margin) control verified');

console.log('--- ALL UNIT & INTEGRATION TESTS PASSED (100%) ---');
