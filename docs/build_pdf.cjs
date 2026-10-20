const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = [];
  let inCode = false;
  let codeLang = '';
  let inTable = false;
  let tableHeader = true;
  let inList = false;
  let inOrderedList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push('</code></pre>');
        inCode = false;
      } else {
        if (inList) { html.push('</ul>'); inList = false; }
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        if (inTable) { html.push('</tbody></table>'); inTable = false; }
        codeLang = line.trim().slice(3).trim();
        html.push(`<pre class="code-block"><code class="language-${codeLang}">`);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      html.push(escapeHtml(line));
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().split('|').slice(1, -1).map(c => c.trim());
      // Check if separator
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        tableHeader = false;
        continue;
      }

      if (!inTable) {
        if (inList) { html.push('</ul>'); inList = false; }
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        html.push('<table class="doc-table">');
        html.push('<thead><tr>');
        cells.forEach(c => html.push(`<th>${formatInline(c)}</th>`));
        html.push('</tr></thead><tbody>');
        inTable = true;
        tableHeader = false;
      } else {
        html.push('<tr>');
        cells.forEach(c => html.push(`<td>${formatInline(c)}</td>`));
        html.push('</tr>');
      }
      continue;
    } else if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }

    // Lists
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        html.push('<ul>');
        inList = true;
      }
      const content = line.replace(/^\s*[-*]\s+/, '');
      html.push(`<li>${formatInline(content)}</li>`);
      continue;
    } else if (inList && line.trim() === '') {
      html.push('</ul>');
      inList = false;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOrderedList) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<ol>');
        inOrderedList = true;
      }
      const content = line.replace(/^\s*\d+\.\s+/, '');
      html.push(`<li>${formatInline(content)}</li>`);
      continue;
    } else if (inOrderedList && line.trim() === '') {
      html.push('</ol>');
      inOrderedList = false;
    }

    // Blockquotes
    if (line.trim().startsWith('>')) {
      const content = line.replace(/^>\s*/, '');
      html.push(`<blockquote class="doc-quote">${formatInline(content)}</blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$/.test(line.trim())) {
      html.push('<hr class="doc-hr" />');
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      html.push(`<h1 class="doc-h1">${formatInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      html.push(`<h2 class="doc-h2">${formatInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      html.push(`<h3 class="doc-h3">${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      html.push(`<h4 class="doc-h4">${formatInline(line.slice(5))}</h4>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      continue;
    }

    // Normal paragraph
    html.push(`<p class="doc-p">${formatInline(line)}</p>`);
  }

  if (inTable) html.push('</tbody></table>');
  if (inList) html.push('</ul>');
  if (inOrderedList) html.push('</ol>');
  if (inCode) html.push('</code></pre>');

  return html.join('\n');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatInline(text) {
  let res = escapeHtml(text);
  // Bold
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  res = res.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return res;
}

const inputMdPath = path.join(__dirname, 'SWarnaRaksha_Complete_Technical_Documentation.md');
const outputPdfPath = path.join(__dirname, 'SWarnaRaksha_Complete_Technical_Documentation.pdf');

const mdContent = fs.readFileSync(inputMdPath, 'utf8');
const bodyHtml = markdownToHtml(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SwarnaRaksha Technical Documentation</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .doc-h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2pt solid #f59e0b;
      padding-bottom: 4pt;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-before: always;
    }
    .doc-h1:first-of-type {
      page-break-before: avoid;
      margin-top: 0;
    }
    .doc-h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 1pt solid #cbd5e1;
      padding-bottom: 3pt;
      margin-top: 16pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }
    .doc-h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #b45309;
      margin-top: 12pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    .doc-h4 {
      font-size: 10pt;
      font-weight: 600;
      color: #334155;
      margin-top: 10pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }
    .doc-p {
      margin-top: 0;
      margin-bottom: 8pt;
      text-align: justify;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8pt;
      margin-bottom: 14pt;
      font-size: 8.5pt;
      page-break-inside: auto;
    }
    .doc-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    .doc-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 5pt 6pt;
      border: 1pt solid #cbd5e1;
      border-bottom: 2pt solid #94a3b8;
    }
    .doc-table td {
      padding: 4.5pt 6pt;
      border: 1pt solid #e2e8f0;
      vertical-align: top;
    }
    .doc-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .code-block {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 8pt 10pt;
      border-radius: 4pt;
      font-family: "Courier New", Courier, monospace;
      font-size: 8pt;
      overflow-x: auto;
      margin-top: 6pt;
      margin-bottom: 10pt;
      page-break-inside: avoid;
      white-space: pre-wrap;
    }
    .inline-code {
      background-color: #f1f5f9;
      color: #b45309;
      padding: 1pt 3pt;
      border-radius: 2pt;
      font-family: monospace;
      font-size: 8.5pt;
      border: 0.5pt solid #e2e8f0;
    }
    .doc-quote {
      border-left: 3pt solid #f59e0b;
      background-color: #fffbeb;
      margin: 8pt 0;
      padding: 6pt 10pt;
      font-style: italic;
      color: #92400e;
    }
    .doc-hr {
      border: none;
      border-top: 1pt solid #cbd5e1;
      margin: 14pt 0;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 18pt;
    }
    li {
      margin-bottom: 3pt;
    }
    .header-cover {
      text-align: center;
      padding: 40pt 20pt 30pt 20pt;
      border-bottom: 2pt solid #f59e0b;
      margin-bottom: 30pt;
    }
    .header-cover h1 {
      font-size: 26pt;
      color: #0f172a;
      margin-bottom: 8pt;
    }
    .header-cover .subtitle {
      font-size: 14pt;
      color: #b45309;
      font-weight: 600;
      margin-bottom: 20pt;
    }
    .header-cover .meta {
      font-size: 9pt;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header-cover">
    <h1>SwarnaRaksha</h1>
    <div class="subtitle">Jewellery Loan Vault / Loan Management System</div>
    <div class="meta">
      <strong>Complete Technical & Architectural Documentation</strong><br>
      Version 1.0.0 &bull; Release Specification &bull; October 2026<br>
      Offline Desktop Deployment (Electron 34 + React 19 + SQLite WAL)
    </div>
  </div>
  ${bodyHtml}
</body>
</html>`;

const tempHtml = path.join(__dirname, 'temp_doc_render.html');
fs.writeFileSync(tempHtml, fullHtml, 'utf8');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadFile(tempHtml);

  // Wait for rendering
  await new Promise((r) => setTimeout(r, 1200));

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: {
      marginType: 'default',
    },
  });

  fs.writeFileSync(outputPdfPath, pdfBuffer);
  console.log(`SUCCESS: PDF created at ${outputPdfPath} (${pdfBuffer.length} bytes)`);

  try {
    fs.unlinkSync(tempHtml);
  } catch {}

  app.quit();
});
