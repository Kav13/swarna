/**
 * Utility to extract all loaded CSS rules and styles from the document
 * to generate standalone, perfectly styled printable HTML documents and PDFs.
 */

export function extractDocumentStylesHtml(): string {
  let cssText = '';

  // 1. Iterate over all document stylesheets to grab compiled Tailwind CSS rules
  try {
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            cssText += rule.cssText + '\n';
          }
        }
      } catch (e) {
        // In case of any cross-origin restrictions on linked stylesheets
      }
    }
  } catch (e) {
    console.warn('Could not read all document stylesheets:', e);
  }

  // 2. Also collect raw text from all inline <style> tags in document head/body
  try {
    const styleTags = document.querySelectorAll('style');
    styleTags.forEach((tag) => {
      if (tag.textContent) {
        cssText += tag.textContent + '\n';
      }
    });
  } catch (e) {}

  return cssText;
}

/**
 * Returns comprehensive print CSS rules ensuring exact visual fidelity,
 * background colors, borders, typography, and page break behavior.
 */
export function getReceiptPrintStyles(): string {
  return `
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      width: 100% !important;
      line-height: 1.4;
    }
    #printable-document {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ffffff !important;
      display: block !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    tr {
      page-break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #cbd5e1 !important;
    }
    th {
      background-color: #f1f5f9 !important;
    }
    .page-break-avoid, .border, .rounded, .rounded-xl, .rounded-lg {
      page-break-inside: avoid !important;
    }
    .print\\:hidden {
      display: none !important;
    }
  `;
}
