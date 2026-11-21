const urls = ['/', '/gallery', '/film', '/print', '/people']
for (const path of urls) {
  try {
    const response = await fetch('http://127.0.0.1:4175' + path)
    const html = await response.text()
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const canonical = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || ''
    console.log(path, '=>', response.status, html.length + 'B', 'title=', title, '| canonical=', canonical)
  } catch (error) {
    console.log(path, 'ERR', error.message)
  }
}
