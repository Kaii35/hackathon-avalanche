// Standalone Markdown → PDF converter using `marked` for HTML rendering
// and headless Microsoft Edge / Chrome for PDF printing.
// Usage: node scripts/md-to-pdf.mjs <input.md> [output.pdf]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { marked } from 'marked';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node md-to-pdf.mjs <input.md> [output.pdf]');
  process.exit(1);
}

const inputPath = resolve(args[0]);
const outputPath = resolve(args[1] ?? inputPath.replace(/\.md$/i, '.pdf'));
const tmpHtml = resolve(tmpdir(), `${basename(inputPath, extname(inputPath))}-${Date.now()}.html`);

if (!existsSync(inputPath)) {
  console.error(`Not found: ${inputPath}`);
  process.exit(1);
}

let raw = readFileSync(inputPath, 'utf8');

// Strip YAML frontmatter (used by md-to-pdf for config; we ignore it)
if (raw.startsWith('---')) {
  const end = raw.indexOf('\n---', 3);
  if (end > 0) raw = raw.slice(end + 4).replace(/^\s+/, '');
}

const bodyHtml = marked.parse(raw, { gfm: true, breaks: false });

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Guía de Documentación · Mercado Secundario IFC</title>
<style>
  @page {
    size: A4;
    margin: 22mm 18mm;
  }
  :root {
    --brand: #E84142;
    --ink: #111;
    --muted: #555;
    --rule: #e6e6e9;
    --code-bg: #f5f5f7;
    --code-ink: #c7254e;
    --pre-bg: #1e1e22;
    --pre-ink: #e6e6e6;
  }
  * { box-sizing: border-box; }
  html, body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: var(--ink);
    line-height: 1.55;
    font-size: 10.5pt;
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }
  h1 {
    color: var(--brand);
    font-size: 24pt;
    border-bottom: 2px solid var(--brand);
    padding-bottom: 6pt;
    margin: 0 0 14pt 0;
    page-break-before: always;
  }
  h1:first-of-type { page-break-before: auto; }
  h2 {
    color: var(--ink);
    font-size: 14pt;
    margin: 22pt 0 8pt 0;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 4pt;
    page-break-after: avoid;
  }
  h3 {
    color: #222;
    font-size: 11.5pt;
    margin: 16pt 0 6pt 0;
    page-break-after: avoid;
  }
  p { margin: 0 0 9pt 0; }
  code {
    background: var(--code-bg);
    padding: 1pt 5pt;
    border-radius: 3pt;
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
    font-size: 9pt;
    color: var(--code-ink);
  }
  pre {
    background: var(--pre-bg);
    color: var(--pre-ink);
    padding: 12pt 14pt;
    border-radius: 6pt;
    overflow: hidden;
    font-size: 8.5pt;
    line-height: 1.45;
    page-break-inside: avoid;
    white-space: pre-wrap;
    word-break: break-word;
  }
  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10pt 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid var(--rule);
    padding: 5pt 8pt;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #fafafa;
    font-weight: 600;
    color: #222;
  }
  blockquote {
    border-left: 3px solid var(--brand);
    padding: 4pt 12pt;
    margin: 10pt 0;
    color: var(--muted);
    font-style: italic;
    background: #fff7f7;
  }
  blockquote p { margin: 4pt 0; }
  a { color: var(--brand); text-decoration: none; }
  ul, ol { padding-left: 20pt; margin: 6pt 0 10pt 0; }
  li { margin: 2pt 0; }
  hr {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 18pt 0;
  }
  strong { color: #000; font-weight: 600; }
  /* Print niceties */
  @media print {
    h1, h2, h3 { page-break-after: avoid; }
    table, pre, blockquote { page-break-inside: avoid; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

writeFileSync(tmpHtml, html, 'utf8');
console.log(`HTML rendered → ${tmpHtml}`);

const browsers = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const browser = browsers.find((p) => existsSync(p));
if (!browser) {
  console.error('No Edge/Chrome found. HTML written to:', tmpHtml);
  console.error('Open it in any browser and Ctrl+P → Save as PDF.');
  process.exit(2);
}

const fileUrl = `file:///${tmpHtml.replace(/\\/g, '/')}`;
const result = spawnSync(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${outputPath}`,
    fileUrl,
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error('Browser print exited with status', result.status);
  process.exit(result.status ?? 1);
}

console.log(`PDF written → ${outputPath}`);
