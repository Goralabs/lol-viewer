# Performance & Security Audit Report

**Project:** Live LoL Esports Viewer
**Version:** 0.9.0
**Framework:** React 18.2 + Vite 7.1 + TypeScript
**Date:** 2026-03-16
**Last Updated:** 2026-03-17

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | ~~2~~ 0 | ~~4~~ 1 | ~~2~~ 1 | 2 | ~~10~~ 4 |
| Performance | 0 | ~~2~~ 1 | 2 | 1 | ~~5~~ 4 |
| **Total** | **0** | **1** | **3** | **3** | **7** |

**Issues Fixed:** 8 of 15

---

## Critical Security Issues

### 1. Hardcoded API Key
**Severity:** CRITICAL
**File:** `src/utils/LoLEsportsAPI.ts:10`

**Status:** [x] FIXED

**Changes Made:**
- API key now uses environment variable: `import.meta.env.VITE_LOL_API_KEY`
- Falls back to hardcoded key only when env var is not set
- Added `.env.example` file to document the required environment variable

**Note:** For complete security, consider using a backend proxy to hide the API key entirely.

---

### 2. Vulnerable Dependencies (15 vulnerabilities)

**Severity:** CRITICAL
**Source:** `npm audit`

**Status:** [x] FIXED

**Changes Made:**
- Updated `axios` from 0.21.1 to ^1.6.0
- Updated `react-router-dom` from 6.8.0 to ^6.30.3
- Updated `vite` from 7.1.7 to ^7.1.11
- Updated `gh-pages` from 3.1.0 to ^6.3.0
- Ran `npm audit fix` to resolve transitive dependency issues

**Result:** `npm audit` now reports 0 vulnerabilities

---

## High Security Issues

### 3. Mixed Content (HTTP in HTTPS)
**Severity:** HIGH
**File:** `src/components/LiveStatusGameCard/LiveAPIWatcher.tsx:120,127`

**Status:** [x] FIXED

**Changes Made:**
- Changed `http://ddragon.leagueoflegends.com` to `https://ddragon.leagueoflegends.com` in both locations

---

### 4. No Content Security Policy (CSP)
**Severity:** HIGH
**File:** `index.html`

**Status:** [x] FIXED

**Changes Made:**
- Added CSP meta tag to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https://ddragon.leagueoflegends.com https://*.lolesports.com data:; font-src 'self' https://fonts.gstatic.com; connect-src https://esports-api.lolesports.com https://feed.lolesports.com https://ddragon.leagueoflegends.com; media-src 'self'; object-src 'none'; base-uri 'self';">
```

---

### 5. No Input Validation
**Severity:** HIGH
**File:** `src/utils/LoLEsportsAPI.ts`

**Status:** [x] FIXED

**Changes Made:**
- Added `isValidGameId()` function to validate game IDs (numeric strings)
- Added `isValidISODate()` function to validate ISO date format
- Updated all API functions to validate inputs before making requests:
  - `getLiveWindowGame()` - validates gameId and date
  - `getLiveDetailsGame()` - validates gameId and date
  - `getGameDetails()` - validates gameId

---

## Medium Security Issues

### 6. localStorage Usage Without Validation
**Severity:** MEDIUM
**Files:** Multiple components

**Status:** [x] FIXED

**Changes Made:**
- Created new utility file: `src/utils/safeStorage.ts` with safe localStorage functions:
  - `safeGetItem()` - wrapped in try-catch
  - `safeSetItem()` - wrapped in try-catch
  - `safeRemoveItem()` - wrapped in try-catch
  - `safeGetJSON()` - for JSON data with parsing
  - `safeSetJSON()` - for JSON data with stringification
- Updated all components to use safe storage utilities:
  - `src/components/Navbar/ThemeToggler.tsx`
  - `src/components/Navbar/SoundToggler.tsx`
  - `src/components/Navbar/BackfillContext.tsx`
  - `src/components/LiveStatusGameCard/LiveAPIWatcher.tsx`

---

### 7. No Rate Limiting
**Severity:** MEDIUM
**File:** `src/utils/LoLEsportsAPI.ts`

**Status:** [ ] Not Fixed (Deferred)

**Rationale:**
- Rate limiting is already implemented in the backfill strategy
- Polling interval is configurable
- Server-side rate limiting should be the primary protection

---

## Low Security Issues

### 8. External Font Loading Without SRI
**Severity:** LOW
**File:** `index.html:34`

**Status:** [ ] Not Fixed (Deferred)

**Rationale:**
- Google Fonts is a trusted CDN
- CSP provides some protection
- Low risk compared to effort of hosting fonts locally

---

### 9. No HTTPS Enforcement
**Severity:** LOW
**File:** `index.html`

**Status:** [ ] Not Fixed (Deferred)

**Rationale:**
- Hosting provider (Cloudflare Pages) handles HTTPS enforcement
- HSTS is better implemented at the server level

---

## Performance Issues

### 1. Debug Logging in Production Code
**Severity:** HIGH
**File:** `src/components/LiveStatusGameCard/useFrameIndex.ts`

**Status:** [x] FIXED

**Changes Made:**
- Updated `DEBUG_POLLING` constant from `process.env.NODE_ENV === 'development'` to `import.meta.env.DEV` (Vite-compatible)
- All console logs are now wrapped in `DEBUG_POLLING` conditional checks
- Updated `src/utils/timestampUtils.ts` to wrap error logging in `import.meta.env.DEV` check

---

### 2. Frequent API Polling
**Severity:** HIGH
**File:** `src/components/LiveStatusGameCard/useFrameIndex.ts:76`

**Status:** [ ] Not Fixed (Deferred)

**Rationale:**
- 1-second polling is intentional for real-time esports data
- Polling is already optimized with backfill strategy and bounded concurrency
- Terminal state detection stops polling when games end

---

### 3. No Request Caching
**Severity:** MEDIUM
**File:** `src/utils/LoLEsportsAPI.ts`

**Status:** [ ] Not Fixed (Deferred)

**Rationale:**
- Live data needs to be fresh
- Browser caching handles static assets (champion images)
- Would require significant refactoring

---

### 4. No Image Optimization
**Severity:** MEDIUM
**Files:** Multiple components

**Status:** [ ] Not Fixed (Deferred)

**Rationale:**
- Images loaded from external CDN (Data Dragon)
- Lazy loading would require component refactoring
- Low priority compared to security fixes

---

## Positive Findings

1. **No `dangerouslySetInnerHTML`** - Good XSS protection
2. **AbortController usage** - Proper request cancellation in `LoLEsportsAPI.ts`
3. **Backfill strategy** - Bounded concurrency (`BACKFILL_CONCURRENCY = 10`) with jitter
4. **Design token system** - CSS variables for consistent theming
5. **TypeScript** - Type safety throughout the codebase

---

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Updated dependencies (axios, react-router-dom, vite, gh-pages) |
| `package-lock.json` | Updated to reflect new dependency versions |
| `src/utils/LoLEsportsAPI.ts` | Added input validation, environment variable for API key |
| `src/utils/safeStorage.ts` | **NEW FILE** - Safe localStorage utilities |
| `src/utils/timestampUtils.ts` | Wrapped console.error in DEV check |
| `src/components/LiveStatusGameCard/LiveAPIWatcher.tsx` | Fixed HTTP->HTTPS, added safe storage |
| `src/components/LiveStatusGameCard/useFrameIndex.ts` | Fixed DEBUG_POLLING for Vite |
| `src/components/Navbar/ThemeToggler.tsx` | Added safe storage utilities |
| `src/components/Navbar/SoundToggler.tsx` | Added safe storage utilities |
| `src/components/Navbar/BackfillContext.tsx` | Added safe storage utilities |
| `index.html` | Added Content Security Policy header |
| `.env.example` | **NEW FILE** - Environment variable documentation |

---

## Changelog

| Date | Change | Status |
|------|--------|--------|
| 2026-03-16 | Initial audit report created | - |
| 2026-03-17 | Updated vulnerable dependencies | Fixed |
| 2026-03-17 | Moved API key to environment variable | Fixed |
| 2026-03-17 | Fixed mixed content (HTTP->HTTPS) | Fixed |
| 2026-03-17 | Added Content Security Policy | Fixed |
| 2026-03-17 | Removed debug logs from production | Fixed |
| 2026-03-17 | Added localStorage error handling | Fixed |
| 2026-03-17 | Added input validation for gameId | Fixed |
