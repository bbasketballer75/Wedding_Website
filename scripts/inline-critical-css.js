import { minify } from 'csso'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Critical CSS for above-the-fold content
const criticalCSS = `
/* Critical CSS - Above the Fold */
:root{--color-bg-dark:#0a0a0a;--color-bg-light:#fbfaf8;--color-text:#fefdfb;--color-text-dark:#0a0a0a;--color-text-muted:#737373;--color-gold:#d4af37;--color-gold-light:#fef08a;--font-display:"Cormorant Garamond",serif;--font-body:"Inter",sans-serif;--section-padding:5rem}*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{font-family:var(--font-body);background:var(--color-bg-dark);color:var(--color-text);line-height:1.6;overflow-x:hidden}.hero-container{position:relative;width:100vw;height:100vh;overflow:hidden}.hero-video{position:absolute;top:50%;left:50%;width:100vw;height:100vh;object-fit:cover;transform:translate(-50%,-50%);z-index:10}.hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,0) 0%,rgba(10,10,10,0.4) 50%,rgba(10,10,10,0.8) 100%);z-index:20}.loading-skeleton{background:linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
`

// Read the HTML file
const indexPath = join(process.cwd(), 'index.html')
let html = readFileSync(indexPath, 'utf8')

// Find where to insert critical CSS
const headEndIndex = html.indexOf('</head>')
if (headEndIndex === -1) {
  console.error('Could not find </head> in index.html')
  process.exit(1)
}

// Minify critical CSS
const minifiedCSS = minify(criticalCSS).css

// Create the critical CSS style tag
const criticalStyleTag = `<style>${minifiedCSS}</style>`

// Insert critical CSS before </head>
html = html.slice(0, headEndIndex) + criticalStyleTag + html.slice(headEndIndex)

// Add preload for non-critical CSS
const cssLink = '<link rel="stylesheet" href="/src/index.css" />'
const preloadedCSS =
  '<link rel="preload" href="/src/index.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'" />'
html = html.replace(cssLink, preloadedCSS)

// Write the updated HTML
writeFileSync(indexPath, html)

console.log('✅ Critical CSS inlined successfully!')
console.log(`📊 Critical CSS size: ${Math.round((minifiedCSS.length / 1024) * 100) / 100} KB`)
