import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const port = 8099
const root = resolve('dist-e2e')
const env = {
  ...process.env,
  EXPO_PUBLIC_DEMO_MODE: '1',
  EXPO_PUBLIC_PAYWALL_PREVIEW: '0',
  EXPO_PUBLIC_COACH_PREVIEW: '0',
  E2E_EXTERNAL_SERVER: '1',
}
const build = spawnSync(
  process.execPath,
  [resolve('node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', root],
  { stdio: 'inherit', env },
)
if (build.status !== 0) process.exit(build.status ?? 1)

const mime = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  const candidate = resolve(root, `.${normalize(pathname)}`)
  const file =
    candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(root, 'index.html')
  res.setHeader(
    'Content-Type',
    `${mime[extname(file)] ?? 'application/octet-stream'}${['.html', '.css', '.js', '.json'].includes(extname(file)) ? '; charset=utf-8' : ''}`,
  )
  createReadStream(file)
    .on('error', () => {
      res.statusCode = 404
      res.end('Not found')
    })
    .pipe(res)
})
await new Promise((resolveReady) => server.listen(port, '127.0.0.1', resolveReady))

const child = spawn(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)],
  { stdio: 'inherit', env },
)
const code = await new Promise((resolveExit) => child.on('exit', (value) => resolveExit(value ?? 1)))
server.closeAllConnections?.()
await new Promise((resolveClosed) => server.close(resolveClosed))
process.exit(code)
