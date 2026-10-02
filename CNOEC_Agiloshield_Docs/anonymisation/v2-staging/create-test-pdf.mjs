import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Construct a raw, valid, minimal PDF 1.4 document with native text stream
function generateMinimalPdf(outputPath) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 720 Td',
    '(FACTURE FICTIVE AGILOSHIELD V2 - TEST DE QUALIFICATION) Tj',
    '/F1 12 Tf',
    '0 -30 Td',
    '(Client : Societe Exemple SAS - 12 Rue de la Paix 75002 Paris) Tj',
    '0 -20 Td',
    '(Contact : Jean Dupont - Telephone : 01 42 68 00 00) Tj',
    '0 -20 Td',
    '(SIRET : 123 456 789 00012 - RCS Paris B 123 456 789) Tj',
    '0 -20 Td',
    '(Date : 02 Octobre 2026 - Facture numero F-2026-0042) Tj',
    '0 -30 Td',
    '(Prestation de conseil technique informatique : 1 500.00 EUR HT) Tj',
    '0 -20 Td',
    '(TVA 20.00 % : 300.00 EUR) Tj',
    '0 -20 Td',
    '(TOTAL TTC A REGLER : 1 800.00 EUR) Tj',
    '0 -40 Td',
    '(Mention legale : Document fictif pour test unitaire de masquage de donnees.) Tj',
    'ET'
  ].join('\n');

  const streamLength = Buffer.byteLength(content, 'utf-8');

  const objects = [
    // 1: Catalog
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    // 2: Pages
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    // 3: Page
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    // 4: Contents
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${content}\nendstream\nendobj\n`,
    // 5: Font
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  let offset = 15; // '%PDF-1.4\n%âãÏÓ\n'.length in ASCII
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];

  let body = '';
  for (const obj of objects) {
    offsets.push(offset);
    body += obj;
    offset += Buffer.byteLength(obj, 'utf-8');
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const pdfData = header + body + xref + trailer;
  fs.writeFileSync(outputPath, pdfData, 'latin1');
  console.log(`✅ PDF fictif généré avec succès (${fs.statSync(outputPath).size} octets) : ${outputPath}`);
}

const targetPath = path.resolve(__dirname, 'sample-facture-fictive.pdf');
generateMinimalPdf(targetPath);
