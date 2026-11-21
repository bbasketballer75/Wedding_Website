const paths = ['/', '/gallery', '/film', '/print', '/people']
for (const p of paths) {
  const response = await fetch('http://127.0.0.1:4175' + p)
  const html = await response.text()
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
  console.log(p, response.status, html.length + 'B', '|', title)
}
