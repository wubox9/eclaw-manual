import * as esbuild from 'esbuild'
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'dist')
const publicDir = join(__dirname, 'public')
const assetsDir = join(distDir, 'assets')

// Ensure dist/assets exists
mkdirSync(assetsDir, { recursive: true })

// Bundle with esbuild
await esbuild.build({
  entryPoints: [join(__dirname, 'src/main.tsx')],
  bundle: true,
  minify: true,
  outdir: assetsDir,
  entryNames: 'app',
  format: 'esm',
  jsx: 'automatic',
  target: 'es2022',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  sourcemap: false,
})

// Copy public/ contents to dist/
if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true })
}

// Generate dist/index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
  <meta name="theme-color" content="#0d0d0d">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="description" content="Voice interface for eClaw Gateway">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' blob: data:">
  <title>eclaw-phone</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg">
  <link rel="apple-touch-icon" href="/icons/icon-192.svg">
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
  <div id="root"></div>
  <script src="/assets/app.js"></script>
</body>
</html>
`

writeFileSync(join(distDir, 'index.html'), indexHtml)

console.log('Build complete: dist/')
