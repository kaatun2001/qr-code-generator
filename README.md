# Signal QR

A clean, fully client-side QR code generator. Build codes for links, Wi‑Fi credentials, contact cards, calendar events, email, SMS, and phone numbers — then style them and export as PNG, SVG, or printed copy.

**100% private.** All generation happens in your browser. Nothing is uploaded, stored, or tracked.

> ![Screenshot](screenshot.png)
> _Add a screenshot of the app here — capture the main workspace with a generated code in the preview panel._

---

## Features

- **8 QR types** — URL, Text, Wi‑Fi, Email, Phone, SMS, vCard (Contact), and calendar Event.
- **Style presets** — five professional color themes (Classic, Navy, Forest, Sunset, Slate), plus full manual control.
- **Customization** — foreground/background colors with a live contrast warning, quiet-zone (margin) control, export size, error-correction level, and rounded-module style.
- **Reset without friction** — separate "Reset all" (form) and "Reset customization to defaults" (style) actions.
- **Light/dark theme** — toggle persisted in `localStorage`, follows the OS setting on first visit.
- **Session history** — last generated codes saved to `localStorage`; each card shows its type and a short description and restores the code with one click. Clearing or deleting an entry never re-adds it.
- **Responsive, keyboard-friendly UI** — focus states, ARIA labels, live status announcements, disabled/loading button states, and feedback for every export action.

## Supported QR types

| Type | Data encoded |
|------|--------------|
| URL | `https://` link (auto-prefixed if missing) |
| Text | Free-form text |
| Wi‑Fi | `WIFI:` credential string with escaping |
| Email | `mailto:` link with subject/body |
| Phone | `tel:` link |
| SMS | `SMSTO:` message |
| Contact | vCard 3.0 (name, org, phone, email, website) |
| Event | iCalendar event (title, start, end, location, description) |

## Export options

- **PNG** — raster download at your chosen size (180–640 px), background-colored.
- **SVG** — vector download, infinitely scalable, same styling.
- **Copy image** — copies PNG to the clipboard.
- **Print** — opens a print-ready page.
- **Share** — native share sheet when the browser supports it.

Downloaded files use descriptive names, e.g. `signal-qr-wifi-260px.png`.

## Tech stack

- Plain **HTML / CSS / JavaScript** (ES6+). No framework, no build step, no backend.
- **qrcode-generator** by [Kazuhiko Arase](https://github.com/kazuhikoarase/qrcode-generator) (MIT) with UTF‑8 support — reliable encoding of emoji, CJK, and accented characters. Vendored locally in `qrcode-generator.js`.
- **Canvas API** for raster rendering, hand-built SVG strings for vector export.

## Run locally

The app is static and needs no server, but a local server keeps module/font behavior identical to production. From this directory:

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a modern browser.

## Browser requirements

Any evergreen browser: Chrome/Edge (latest), Firefox, Safari 16+, or similar. Clipboard, print, and Web Share use standard web APIs with graceful fallbacks.

## Privacy

Everything runs client-side. QR payloads, history, and theme preference never leave your device — history and theme are stored in your browser's `localStorage` only.

## Project structure

```
qr code/
├── index.html          # Page structure & ARIA
├── style.css           # Design tokens (light/dark), layout, responsive
├── qr.js               # App logic: forms, rendering, export, history
├── qrcode-generator.js # Vendored qrcode-generator (MIT) + UTF-8 support
├── test-runner.js      # Headless Node test suite (no framework)
└── README.md
```

## Tests

```bash
node test-runner.js
```

Covers all 8 payload builders, matrix generation for Unicode/emoji at every error-correction level, long-text capacity, clean overflow failure, contrast math, and quiet-zone geometry.

## License

The app source is MIT-licensed. The vendored `qrcode-generator.js` is MIT © 2009–2011 Kazuhiko Arase (QR Code is a registered trademark of Denso Wave Incorporated).
