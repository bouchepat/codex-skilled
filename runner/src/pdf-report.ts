import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';

export async function renderMarkdownToPdf(markdown: string, outputPath: string, title: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = createWriteStream(outputPath);

    stream.on('finish', () => resolve());
    stream.on('error', reject);
    document.on('error', reject);

    document.pipe(stream);

    document.fontSize(18).font('Helvetica-Bold').text(title, { align: 'left' });
    document.moveDown(0.5);

    const lines = markdown.split(/\r?\n/);
    for (const line of lines) {
      writeMarkdownLine(document, line);
    }

    document.end();
  });
}

function writeMarkdownLine(document: any, line: string): void {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    document.moveDown(0.6);
    return;
  }

  if (trimmed.startsWith('# ')) {
    document.moveDown(0.3);
    document.fontSize(16).font('Helvetica-Bold').text(trimmed.slice(2));
    document.moveDown(0.2);
    return;
  }

  if (trimmed.startsWith('## ')) {
    document.moveDown(0.2);
    document.fontSize(13).font('Helvetica-Bold').text(trimmed.slice(3));
    document.moveDown(0.1);
    return;
  }

  if (trimmed.startsWith('- ')) {
    document.fontSize(10.5).font('Helvetica').text(`• ${trimmed.slice(2)}`, { indent: 12 });
    return;
  }

  document.fontSize(10.5).font('Helvetica').text(trimmed, { align: 'left' });
}
