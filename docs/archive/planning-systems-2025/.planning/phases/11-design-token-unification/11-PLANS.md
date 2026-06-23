# Phase 11: Design Token Unification - Plans Summary

**Phase:** 11-design-token-unification
**Status:** 4/4 plans created
**Created:** 2026-04-28

## Plans Overview

| Plan | Requirement | Wave | Depends On | Files |
|------|-------------|------|------------|-------|
| 11-01 | UX-05 (part 1), D-01 | 1 | None | designTokens.ts, index.css |
| 11-02 | UX-03 | 1 | 11-01 | Footer.tsx |
| 11-03 | UX-04 | 1 | 11-01 | Home.tsx, EngagementSection.css |
| 11-04 | UX-06 | 1 | 11-01 | Avatar.tsx (verification) |

## Plan Details

### 11-01: Align Gold Token Values
**Purpose:** Resolve gold-500 conflict between designTokens.ts (#c9a05c) and themes/index.ts (#d4af37)

**Key Changes:**
- designTokens.ts line 11: `500: '#c9a05c'` → `500: '#d4af37'`
- index.css line 29: `--color-gold-500: #c9a05c` → `--color-gold-500: #d4af37`
- index.css line 93: shadow-gold rgba update

**Success Criteria:**
- [ ] `grep -rn "#c9a05c" src/tokens/designTokens.ts src/index.css` returns no matches
- [ ] Build completes without errors

---

### 11-02: Replace Hardcoded Hex in Footer.tsx
**Purpose:** Per UX-03, replace all hardcoded hex values in Footer.tsx

**Key Changes:**
- Line 42: `text-[#f7e6c6]` → `text-gold-200`
- Line 54: `text-[#f2dfba]` → `text-gold-200/80`
- Line 87: `text-[#fff3de]` → `text-gold-100`
- Lines 98,104: `text-[#fff4e4]` → `text-gold-100/90`

**Success Criteria:**
- [ ] Footer.tsx contains no hardcoded hex values
- [ ] All colors use gold-* token scale

---

### 11-03: Replace Hardcoded Hex in Home Page Sections
**Purpose:** Per UX-04, replace hardcoded hex in Home page and EngagementSection.css

**Key Changes:**
- Home.tsx line 259: `bg-[#1a1208]` → `bg-charcoal-900`
- EngagementSection.css: 3 instances of `#d4af37` → `var(--color-gold-500)`

**Success Criteria:**
- [ ] Home.tsx uses no hardcoded hex colors
- [ ] EngagementSection.css uses var(--color-gold-500) for all instances

---

### 11-04: Verify Avatar Gradient Standardization
**Purpose:** Per UX-06, verify Avatar gradient is consistent

**Key Findings:**
- Avatar.tsx already uses standard gradient `from-gold-100 to-gold-200` (line 55)
- No inline gradient overrides found in other files
- UX-06 is already satisfied

**Success Criteria:**
- [ ] Avatar.tsx uses standard gradient
- [ ] No inline Avatar gradient overrides exist

---

## Phase Success Criteria (from ROADMAP.md)

1. Footer.tsx uses only design token colors (no hardcoded hex like #d4af37)
2. Home page sections use only design token colors
3. `shadow-gold` is defined in designTokens.ts or replaced with valid token
4. Avatar components use consistent gradient definition across all usages

---

*Plans summary created: 2026-04-28*
