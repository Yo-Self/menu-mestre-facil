import { createServer, type Server } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

/** Porta fixa para whitelist estável no Google Cloud Console (HTTP referrers). */
export const ELECTRON_RENDERER_PORT = 47832

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}

let activeServer: Server | null = null

export async function startRendererServer(rendererDir: string): Promise<string> {
  if (activeServer) {
    return `http://127.0.0.1:${ELECTRON_RENDERER_PORT}`
  }

  const root = normalize(rendererDir)

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0] || '/')
        const safePath = rawPath.replace(/\.\.(\/|\\|$)/g, '')
        const relativePath = safePath === '/' ? '/index.html' : safePath
        const filePath = normalize(join(root, relativePath))

        if (!filePath.startsWith(root)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        const fileStat = await stat(filePath)
        if (!fileStat.isFile()) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const content = await readFile(filePath)
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        res.end(content)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    server.on('error', reject)
    server.listen(ELECTRON_RENDERER_PORT, '127.0.0.1', () => {
      activeServer = server
      resolve(`http://127.0.0.1:${ELECTRON_RENDERER_PORT}`)
    })
  })
}

export function stopRendererServer(): void {
  if (activeServer) {
    activeServer.close()
    activeServer = null
  }
}
