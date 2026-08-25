// Headless boot + main-flow smoke test for QR Code Generator.
// Loads qrcode-generator.js and qr.js in a fake DOM, drives a URL generation,
// and verifies paint, status, history, restore, and clean oversized-content handling.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      const should = force === undefined ? !set.has(c) : Boolean(force);
      if (should) set.add(c); else set.delete(c);
      return should;
    }
  };
}

function makeEl(tag) {
  const listeners = {};
  const el = {
    tagName: tag,
    id: '',
    name: '',
    value: '',
    textContent: '',
    className: '',
    hidden: false,
    disabled: false,
    checked: false,
    required: false,
    placeholder: '',
    type: '',
    htmlFor: '',
    download: '',
    href: '',
    src: '',
    alt: '',
    dataset: {},
    style: {},
    children: [],
    classList: makeClassList(),
    addEventListener: (type, fn) => {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    dispatch: (type, evt = {}) => {
      (listeners[type] || []).forEach((fn) => fn(evt));
    },
    setAttribute: (k, v) => { el._attrs = el._attrs || {}; el._attrs[k] = String(v); },
    getAttribute: (k) => (el._attrs && el._attrs[k]) || null,
    append: (...kids) => kids.forEach((k) => el.children.push(k)),
    appendChild: (k) => { el.children.push(k); return k; },
    remove: () => {},
    add: (opt) => { el._options = el._options || []; el._options.push(opt); },
    click: () => {},
    focus: () => {},
    querySelector: (sel) => {
      for (const c of el.children) {
        if (sel.startsWith('.') && c.className && c.className.split(' ').includes(sel.slice(1))) return c;
        if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
      }
      return undefined;
    }
  };
  return el;
}

// --- element registry keyed by CSS selector ---
const els = {};
const querySelector = (sel) => els[sel];
const querySelectorAll = (sel) => els[sel] || [];
function reg(sel, tag) {
  const el = makeEl(tag);
  els[sel] = el;
  return el;
}

// --- form input registry: FormData reads form._inputs ---
const form = reg('#qr-form', 'form');
form._inputs = {};

// Theme toggle children (queried via themeToggle.querySelector)
const themeIcon = makeEl('span'); themeIcon.className = 'theme-icon';
const themeText = makeEl('span'); themeText.className = 'theme-text';
const themeToggle = reg('#theme-toggle', 'button');
themeToggle.children.push(themeIcon, themeText);

// Controls referenced by getOptions / syncOptionLabels
reg('#foreground', 'input').value = '#101519';
reg('#background', 'input').value = '#ffffff';
reg('#foreground-value', 'output').textContent = '#101519';
reg('#background-value', 'output').textContent = '#FFFFFF';
reg('#size', 'select').value = '260';
reg('#correction', 'select').value = 'M';
reg('#margin', 'select').value = '4';
const rounded = reg('#rounded', 'input'); rounded.type = 'checkbox'; rounded.checked = false;

// Fields container + validation
reg('#form-fields', 'div');
reg('#validation', 'p');

// Canvas
const canvas = reg('#qr-canvas', 'canvas');
canvas.getContext = () => ({
  fillStyle: '',
  fillRect: () => {},
  beginPath: () => {},
  roundRect: () => {},
  rect: () => {},
  fill: () => {}
});
canvas.toDataURL = () => 'data:image/png;base64,AAAA';
canvas.toBlob = (cb) => cb({ size: 8, type: 'image/png' });

reg('#empty-state', 'div');
reg('#preview-status', 'span').textContent = 'Waiting';
reg('#payload-label', 'p');
reg('#contrast-warning', 'div').hidden = true;
reg('#action-message', 'p');

['png', 'svg'].forEach((k) => reg(`#download-${k}`, 'button').disabled = true);
reg('#copy-btn', 'button').disabled = true;
reg('#print-btn', 'button').disabled = true;
const shareBtn = reg('#share-btn', 'button');
shareBtn.hidden = true;

// History
const historyList = reg('#history-list', 'ul');
reg('#history-empty', 'p');
reg('#clear-history', 'button').disabled = true;

// Action rows
reg('#reset-btn', 'button');
reg('#reset-custom-btn', 'button');

// Tabs / presets / style chips
const tabNames = ['url', 'text', 'wifi', 'email', 'phone', 'sms', 'vcard', 'event'];
els['.type-tab'] = tabNames.map((t) => {
  const tab = makeEl('button');
  tab.dataset.type = t;
  tab.classList.add(t === 'url' ? 'is-active' : '');
  tab.setAttribute('aria-selected', String(t === 'url'));
  return tab;
});
els['.preset'] = ['website', 'wifi', 'contact', 'event'].map((p) => {
  const b = makeEl('button');
  b.dataset.preset = p;
  return b;
});
els['.style-chip'] = ['classic', 'navy', 'forest', 'sunset', 'slate'].map((s) => {
  const b = makeEl('button');
  b.dataset.style = s;
  return b;
});

// document / window / globals
const localStorageStore = {};
const sandbox = {
  window: {},
  document: {
    querySelector,
    querySelectorAll,
    documentElement: makeEl('html'),
    body: makeEl('body'),
    head: makeEl('head'),
    createElement: null, // replaced below
    createElementNS: (ns, tag) => makeEl(tag)
  },
  navigator: { share: undefined, canShare: undefined, clipboard: undefined },
  localStorage: {
    getItem: (k) => (k in localStorageStore ? localStorageStore[k] : null),
    setItem: (k, v) => { localStorageStore[k] = String(v); }
  },
  Option: class { constructor(text, value) { this.text = text; this.value = value; } },
  Image: class { constructor() {} },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  FormData,
  Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } },
  File: class { constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts && opts.type; } },
  URL,
  URLSearchParams,
  console
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;
sandbox.window.matchMedia = () => ({ matches: false });
sandbox.window.scrollTo = () => {};
sandbox.window.open = () => null;
sandbox.window.ClipboardItem = undefined;
sandbox.URL.createObjectURL = () => 'blob:fake';
sandbox.URL.revokeObjectURL = () => {};

// FormData reads the live form input registry.
sandbox.FormData = class {
  constructor() {
    this._entries = [];
    for (const [name, el] of Object.entries(form._inputs)) {
      if (el.checked) this._entries.push([name, 'on']);
      else if (el.value !== undefined && el.value !== '') this._entries.push([name, String(el.value)]);
    }
  }
  entries() { return this._entries; }
};

// Intercept element creation so dynamically rendered fields are registered
// by id (els registry) and name (FormData registry).
const baseCreate = (tag) => makeEl(tag);
sandbox.document.createElement = (tag) => {
  const el = baseCreate(tag);
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    Object.defineProperty(el, 'id', {
      set(v) { this._id = v; if (v) els[`#${v}`] = el; },
      get() { return this._id; }
    });
    Object.defineProperty(el, 'name', {
      set(v) { this._name = v; if (v) form._inputs[v] = el; },
      get() { return this._name; }
    });
  }
  return el;
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('qrcode-generator.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('qr.js', 'utf8'), sandbox);

console.log('✓ app booted without throwing (initTheme, renderFields, renderHistory)');

// --- Main flow: generate a URL QR code ---
const urlInput = els['#field-url'];
assert.ok(urlInput, 'URL field should be rendered at boot');
urlInput.value = 'https://example.com/hello?x=1';
form.dispatch('input');

assert.ok(canvas.classList.contains('is-visible'), 'canvas should be visible after valid input');
assert.ok(canvas.width > 0 && canvas.height > 0, 'canvas should be painted with dimensions');
assert.strictEqual(els['#preview-status'].textContent, 'Ready', 'status should read Ready');
assert.ok(els['#payload-label'].textContent.includes('URL'), 'payload label should show type + content');
assert.strictEqual(els['#validation'].textContent, '', 'no validation error for valid URL');
assert.ok(!els['#download-png'].disabled, 'export buttons should enable after generation');
console.log('✓ URL generation paints canvas, enables exports, updates status');

// --- History: entry saved after debounce ---
setTimeout(() => {
  const stored = JSON.parse(localStorageStore['signal-qr-history-v1'] || '[]');
  assert.strictEqual(stored.length, 1, 'history should contain one entry');
  assert.strictEqual(stored[0].type, 'url', 'history entry type should be url');
  assert.strictEqual(historyList.children.length, 1, 'history list should render one card');
  console.log('✓ history saves and renders a card with type + summary');

  // --- Oversized content fails cleanly (no crash, clear message) ---
  urlInput.value = 'https://example.com/' + 'a'.repeat(5000);
  form.dispatch('input');
  assert.ok(!canvas.classList.contains('is-visible'), 'canvas should clear on oversized content');
  assert.ok(
    /too long|capacity/i.test(els['#validation'].textContent),
    'validation should explain oversized content, got: ' + els['#validation'].textContent
  );
  assert.ok(els['#download-png'].disabled, 'exports should disable on invalid content');
  console.log('✓ oversized content fails cleanly with explanatory message');

  // --- Restore from history re-renders the code ---
  const restoreBtn = historyList.children[0].children[0];
  restoreBtn.dispatch('click');
  assert.ok(canvas.classList.contains('is-visible'), 'restoring history should repaint the QR');
  assert.strictEqual(els['#field-url'].value, 'https://example.com/hello?x=1', 'restore should refill the URL field');
  console.log('✓ history restore repaints the code and refills fields');

  // --- Reset all clears the preview ---
  els['#reset-btn'].dispatch('click');
  assert.ok(!canvas.classList.contains('is-visible'), 'reset should clear the canvas');
  assert.strictEqual(els['#preview-status'].textContent, 'Waiting', 'status should return to Waiting');
  console.log('✓ reset-all clears preview without throwing');

  console.log('--- BOOT SMOKE TEST PASSED ---');
  process.exit(0);
}, 700);
