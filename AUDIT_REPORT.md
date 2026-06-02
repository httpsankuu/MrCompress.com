# MrCompress — Codebase Audit Report

> **Date:** June 2, 2026  
> **Scope:** Full source code audit (Astro + React + Tailwind v4)  
> **Branch:** `master`  
> **Build:** Passes (9 pages generated, 42s)

---

## Executive Summary

The project builds successfully and the core functionality (image compression/conversion via Canvas API) is sound. The audit uncovered **4 critical issues**, **5 medium issues**, and **3 low-priority issues**. The most pressing concerns are:

1. **Privacy Policy contradicts actual behavior** — Google Analytics is loaded on every page while the privacy page claims "no analytics."
2. **Undefined CSS theme tokens** — `text-body` and `cyan-deep` are used throughout but never declared in the Tailwind theme.
3. **Missing Typography plugin** — `prose` classes used on 4 pages without the required `@tailwindcss/typography` plugin.
4. **Dead CSS for wrong library** — Styles for `react-easy-crop` exist, but the project uses `react-image-crop`.

---

## 🔴 Critical Issues

### C1. Google Analytics vs. Privacy Policy (Contradiction)

**Files:** `src/layouts/Layout.astro` (lines 49–59), `src/pages/privacy.astro`

**Problem:**
The Privacy Policy at `/privacy` states:

> *"We do not use any third-party tracking or analytics scripts that could compromise your privacy."*

However, `Layout.astro` loads Google Analytics (gtag.js) on **every page**:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XRTV018ZBF"></script>
<script is:inline>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XRTV018ZBF');
</script>
```

**Fix options:**
1. **Remove Google Analytics** — aligns with the privacy-first positioning and the "no uploads, no servers" brand promise.
2. **Update the Privacy Policy** to disclose analytics usage (opt-in consent recommended).

---

### C2. `text-body` Class Used But `--color-body` Not Defined

**Files affected:** 9 files, 19 occurrences total

| File | Occurrences |
|------|-------------|
| `src/pages/index.astro` | 9 |
| `src/pages/contact.astro` | 3 |
| `src/pages/compress.astro` | 1 |
| `src/pages/convert.astro` | 1 |
| `src/pages/about.astro` | 1 |
| `src/pages/404.astro` | 1 |
| `src/pages/500.astro` | 1 |
| `src/pages/privacy.astro` | 1 |
| `src/pages/terms.astro` | 1 |

**Problem:**
The CSS theme in `src/styles/global.css` defines:
```
--color-ink: #171717;
--color-mute: #737373;
--color-canvas: #ffffff;
--color-canvas-soft: #fafafa;
--color-canvas-soft-2: #f5f5f5;
--color-hairline: #ebebeb;
--color-hairline-strong: #a1a1a1;
...
```

**`--color-body` is missing.** The `text-body` class resolves to `color: var(--color-body)`, which is `undefined`, so it silently falls back to the element's default text color (usually `--color-ink`). This means secondary body text renders at the same visual weight as headings — breaking the visual hierarchy intended in `DESIGN.md` (body text should be `#4d4d4d`).

**Fix:**
Add to the theme block in `global.css`:
```css
--color-body: #4d4d4d;
```
And add its dark-mode override:
```css
--dark-body: #a3a3a3;
.dark {
  --color-body: var(--dark-body);
}
```

---

### C3. `to-cyan-deep` Gradient Class Uses Undefined Token

**Files affected:** 4 files, 4 occurrences

| File | Line |
|------|------|
| `src/pages/compress.astro` | `from-geist-link to-cyan-deep` |
| `src/pages/convert.astro` | `from-geist-link to-cyan-deep` |
| `src/pages/404.astro` | `from-geist-link to-cyan-deep` |
| `src/pages/500.astro` | `from-geist-link to-cyan-deep` |

**Problem:**
The gradient `bg-gradient-to-r from-geist-link to-cyan-deep` references `--color-cyan-deep`, which is not defined in the CSS theme. The gradient will render as a single color (`--color-geist-link: #0070f3`) instead of the intended blue-to-cyan transition.

The `DESIGN.md` specifies `cyan-deep: "#29bc9b"` but this was never added to the theme.

**Fix:**
Add to the theme block in `global.css`:
```css
--color-cyan-deep: #29bc9b;
--color-magenta-deep: #eb367f; /* also missing if needed elsewhere */
```

---

### C4. `prose` Classes Used Without `@tailwindcss/typography`

**Files affected:** 4 files

| File | Usage |
|------|-------|
| `src/pages/about.astro` | `prose prose-sm max-w-none text-body` |
| `src/pages/contact.astro` | `prose prose-sm text-body leading-relaxed` |
| `src/pages/privacy.astro` | `prose prose-sm text-body` |
| `src/pages/terms.astro` | `prose prose-sm text-body leading-relaxed` |

**Problem:**
Tailwind CSS v4 does not ship `prose` utilities by default. The `@tailwindcss/typography` plugin is required but is not listed in `package.json` dependencies. The content renders without any typographic styling (no heading margins, no list styles, no paragraph spacing).

**Fix:**
```bash
npm install @tailwindcss/typography
```
Then register in `global.css`:
```css
@plugin "@tailwindcss/typography";
```

---

## 🟠 Medium Issues

### M1. Dead CSS: `react-easy-crop` Overrides For Unused Library

**File:** `src/styles/global.css` (lines 72–91)

**Problem:**
The global stylesheet contains extensive CSS overrides for `react-easy-crop`:
```css
.react-easy-crop_Container { @apply rounded-xl; }
.react-easy-crop_CropArea { @apply border-2 border-canvas shadow-[...]; }
.react-easy-crop_CropArea::after { ... }
```

The project actually uses **`react-image-crop`** (imported in `Optimizer.tsx` line 10). The `react-easy-crop` package is not even installed. These CSS rules are dead code that adds unnecessary bytes (~500 bytes compressed) and could cause confusion.

**Fix:** Remove the `react-easy-crop` CSS overrides from `global.css`.

---

### M2. Duplicate FAQ Question

**File:** `src/pages/index.astro` (FAQ section)

**Problem:**
The question *"How to compress an image?"* appears **twice** in the FAQ grid — at position 1 and position 7. The second occurrence has a slightly different answer text than the first, but both are shown simultaneously.

**Fix:** Remove the duplicate (position 7) or replace it with a different question.

---

### M3. Arabic Translation Typo

**File:** `src/i18n/locales/ar.json`

**Problem:**
The word for "compress" is misspelled:
- Current: `ضغظ` (uses ظ letter)
- Correct: **`ضغط`** (uses ط letter)

This affects two keys: `nav.compress` and `optimizer.compress_tab`.

The letter `ظ` (ẓāʾ) is a different phoneme than `ط` (ṭāʾ) — the word "ضغط" (compression) requires `ط`, not `ظ`.

**Fix:** Replace `ضغظ` with `ضغط` in both occurrences.

---

### M4. Missing Translation Keys in English Locale

**File:** `src/i18n/locales/en.json`

**Problem:**
Three keys present in most other locales are missing from the English translation:

| Missing Key | Present In |
|-------------|------------|
| `optimizer.hold_compare` | fr, de, hi, ja, zh, ar, pt, ru |
| `optimizer.preparing` | fr, de, hi, ja, zh, ar, pt, ru |

The `Optimizer.tsx` component references `t('optimizer.hold_compare', 'Hold to Compare')` and `t('optimizer.preparing', 'Preparing...')` with fallback strings, so the UI falls back to English inline. The keys should be added to `en.json` for consistency:

```json
"hold_compare": "Hold to Compare",
"preparing": "Preparing..."
```

---

### M5. Theme Toggle & Mobile Menu Script Null-Safety

**File:** `src/layouts/Layout.astro` (inline scripts)

**Problem:**
The theme toggle script calls `document.getElementById("theme-toggle").addEventListener(...)` without a null check. While the element exists in the current template, if the nav is ever refactored or conditionally rendered, this will throw a `TypeError`.

Similarly, the mobile menu logic has null checks for `mobileMenuButton`, `mobileMenu`, and `closeMobileMenuButton`, but the theme toggle does not.

**Fix:** Add null guards:
```javascript
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", handleToggleClick);
}
```

---

## 🟢 Low Priority Issues

### L1. `worker-configuration.d.ts` Referenced But Missing

**File:** `tsconfig.json`

**Problem:**
The `tsconfig.json` includes `./worker-configuration.d.ts` in the compilation scope, but this file does not exist in the project root. This file is auto-generated by `wrangler types` (see the `generate-types` script in `package.json`). Without it, you lose type safety for Cloudflare bindings (KV, R2, etc.).

**Fix:** Run `npm run generate-types` to generate the file, or remove the reference if not needed.

---

### L2. `Welcome.astro` — Orphaned Boilerplate Component

**File:** `src/components/Welcome.astro`

**Problem:**
This is the default Astro starter template component. It:
- References `src/assets/astro.svg` and `src/assets/background.svg` (which exist)
- Is not imported or used anywhere in the project
- Adds no value to the MrCompress application
- Adds 3.5 KB of dead code to the bundle

**Fix:** Delete `src/components/Welcome.astro` and its associated assets if unused.

---

### L3. Large JavaScript Chunks

**Build warning:** One or more chunks exceed the 500 kB size limit.

**Problem:**
`pdfjs-dist` alone adds significant weight. During optimization, the PDF worker (imported via `?url`), `jspdf`, and `heic2any` all contribute to large JS bundles.

**Mitigation options:**
- Lazy-load the Optimizer component with `client:visible` instead of `client:only="react"`
- Dynamically import `pdfjs-dist` and `jspdf` only when needed
- Increase `chunkSizeWarningLimit` in Astro config

---

## 📊 Summary Table

| ID | Severity | Category | Issue | Files Affected |
|----|----------|----------|-------|---------------|
| C1 | 🔴 Critical | Legal/Privacy | Google Analytics contradicts Privacy Policy | `Layout.astro`, `privacy.astro` |
| C2 | 🔴 Critical | Visual/CSS | `text-body` class has no theme definition | 9 files, 19 uses |
| C3 | 🔴 Critical | Visual/CSS | `to-cyan-deep` gradient token undefined | 4 pages |
| C4 | 🔴 Critical | Visual/Missing Dep | `prose` classes require missing plugin | 4 pages |
| M1 | 🟠 Medium | Dead Code | `react-easy-crop` CSS for wrong library | `global.css` |
| M2 | 🟠 Medium | Content | Duplicate FAQ question | `index.astro` |
| M3 | 🟠 Medium | L10n | Arabic translation typo (`ضغظ` → `ضغط`) | `ar.json` |
| M4 | 🟠 Medium | L10n | Missing `hold_compare`/`preparing` in en.json | `en.json` |
| M5 | 🟠 Medium | Code Quality | Theme toggle lacks null safety | `Layout.astro` |
| L1 | 🟢 Low | Config | Missing `worker-configuration.d.ts` | `tsconfig.json` |
| L2 | 🟢 Low | Dead Code | Orphaned `Welcome.astro` component | `Welcome.astro` |
| L3 | 🟢 Low | Performance | Large JS chunks (>500 KB) | Build output |

---

## ✅ What's Working Well

- **Build passes** with zero errors; all 9 pages generate correctly
- **Core compression/conversion logic** is solid and well-structured
- **Local-only processing** is genuinely client-side (Canvas API, pdf.js, jspdf)
- **Internationalization** is thorough: 10 languages with near-complete coverage
- **Dark mode** implementation via CSS custom properties is clean
- **Design tokens** in `global.css` follow a well-organized Vercel-inspired system
- **SEO metadata** is properly set up (Open Graph, Twitter cards, canonical URLs)
- **Accessibility basics** included: skip-to-content link, ARIA labels, semantic HTML

---

## 🔧 Recommended Fix Order

1. **C1** — Resolve the Google Analytics/privacy contradiction first (legal risk)
2. **C2 + C3** — Add missing CSS theme tokens (visible bug on every page)
3. **C4** — Install `@tailwindcss/typography` (affects 4 content pages)
4. **M1** — Clean up dead CSS
5. **M2** — Remove duplicate FAQ
6. **M3 + M4** — Fix locale issues
7. **M5 + L1 + L2** — Code quality clean-up
8. **L3** — Performance optimization (as needed)
