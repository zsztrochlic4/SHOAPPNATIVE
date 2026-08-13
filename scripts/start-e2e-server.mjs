import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 8099)
const root = resolve('dist-e2e')
const expoCli = resolve('node_modules/expo/bin/cli')
const build = spawnSync(process.execPath, [expoCli, 'export', '--platform', 'web', '--output-dir', root], {
  stdio: 'inherit',
  env: process.env,
})
if (build.status !== 0) process.exit(build.status ?? 1)

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  const candidate = resolve(root, `.${normalize(pathname)}`)
  let file =
    candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(root, 'index.html')
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
  createReadStream(file)
    .on('error', () => {
      res.statusCode = 404
      res.end('Not found')
    })
    .pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`E2E static server listening on ${port}`))
