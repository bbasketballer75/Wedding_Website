# Product Guidelines

This document establishes the design, content, and user experience standards for the Post-Wedding Archive website.

---

## 🎨 Visual Identity & Design Guidelines

### Theme: Warm & Elegant

- **Typography:** Elegant serif typography (e.g., Cormorant Garamond, Pinyon Script, Allura) for headings and narrative text, paired with clean, readable sans-serif fonts (e.g., Instrument Sans, Inter) for interface elements.
- **Color Palette:** Soft, creamy, and warm tones (e.g., warm whites, champagne, sage greens, and gold accents) that evoke a romantic, celebratory, and archival feel.
- **Layouts:** Classic, balanced grid structures with generous margins and padding to create a spacious, editorial feel.

---

## ✍️ Content Strategy & Tone of Voice

### Tone: Warm & Personal

- **Perspective:** Written primarily from the couple's perspective (Austin & Jordyn), or using a warm, welcoming third-person narrative.
- **Tone:** Joyful, appreciative, and welcoming. The language should feel intimate and narrative-focused, drawing guests back into the warmth of the celebration.
- **Archival Integrity:** Keep details and stories accurate, ensuring dates, locations, and names are clearly documented and easy to find.

---

## ⚡ User Experience & Technical Principles

### 1. Optimized Media Loading

- **Lazy Loading:** Implement lazy loading for all off-screen media.
- **Placeholders:** Use blurhash placeholders to maintain visual stability and provide an elegant loading state before images fully resolve.
- **Performance:** Optimize image assets (WebP format, responsive sizes) to keep page load speeds exceptionally fast, especially on mobile networks.

### 2. Fluid Transitions & Micro-Animations

- **Framer Motion / Anime.js:** Apply subtle, elegant micro-animations (e.g., fade-ins on scroll, smooth page transitions, and gentle hover effects on buttons and cards).
- **Pacing:** Keep animation durations short (200-500ms) with natural easing (e.g., ease-out or custom cubic-bezier) so the site feels responsive, alive, and polished without being distracting.

### 3. High Accessibility (A11y)

- **Contrast:** Ensure text color ratios meet WCAG AA standards against their backgrounds.
- **Keyboard Navigation:** All interactive elements must be keyboard-accessible.
- **Semantics:** Use semantic HTML5 markup and provide appropriate ARIA labels for custom interactive components.
