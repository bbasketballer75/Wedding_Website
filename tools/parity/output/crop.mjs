import sharp from 'sharp'
const left = Math.max(0, 1183-60), top = 0
const w = 120, h = 80
await sharp('tools/parity/output/smoke-home4/shots/legacy/home__desktop__dark--s006.png').extract({left, top, width:w, height:h}).resize(600, 400, {kernel:'nearest'}).png().toFile('tools/parity/output/crop-legacy.png')
await sharp('tools/parity/output/smoke-home4/shots/rebuild/home__desktop__dark--s006.png').extract({left, top, width:w, height:h}).resize(600, 400, {kernel:'nearest'}).png().toFile('tools/parity/output/crop-rebuild.png')
// full nav strip for context
await sharp('tools/parity/output/smoke-home4/shots/legacy/home__desktop__dark--s006.png').extract({left:0, top:0, width:1440, height:90}).resize(1440, 90).png().toFile('tools/parity/output/crop-nav.png')
console.log('done')
