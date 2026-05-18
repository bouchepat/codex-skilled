import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'ordered'; index: number; text: string }
  | { type: 'code'; lines: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'image'; altText: string; ref: string };

const PAGE_MARGIN = 48;
const BODY_FONT = 9.5;
const BODY_LEADING = 1.3;
const TABLE_FONT = 8.5;
const IMAGE_MAX_WIDTH = 500;
const IMAGE_MAX_HEIGHT = 300;
type PdfDoc = InstanceType<typeof PDFDocument>;

export async function renderMarkdownToPdf(markdown: string, outputPath: string, title: string, baseDir = path.dirname(outputPath)): Promise<void> {
  const blocks = parseMarkdownBlocks(markdown);

  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const stream = createWriteStream(outputPath);

    stream.on('finish', () => resolve());
    stream.on('error', reject);
    document.on('error', reject);

    document.pipe(stream);

    document.font('Helvetica-Bold').fontSize(18).text(normalizeText(title), { align: 'left' });
    document.moveDown(0.5);

    (async () => {
      for (const block of blocks) {
        await renderBlock(document, block, baseDir);
      }
      document.end();
    })().catch(reject);
  });
}

async function renderBlock(document: PdfDoc, block: MarkdownBlock, baseDir: string): Promise<void> {
  switch (block.type) {
    case 'heading':
      renderHeading(document, block.level, block.text);
      return;
    case 'paragraph':
      renderParagraph(document, block.text);
      return;
    case 'bullet':
      renderListItem(document, 'â€¢', block.text);
      return;
    case 'ordered':
      renderListItem(document, `${block.index}.`, block.text);
      return;
    case 'code':
      renderCodeBlock(document, block.lines);
      return;
    case 'table':
      renderTable(document, block.rows);
      return;
    case 'image':
      await renderImage(document, block.altText, block.ref, baseDir);
      return;
  }
}

function renderHeading(document: PdfDoc, level: 1 | 2 | 3, text: string): void {
  const cleaned = normalizeText(text);
  const size = level === 1 ? 15 : level === 2 ? 12.5 : 11.5;
  const before = level === 1 ? 8 : 6;
  const after = level === 1 ? 4 : 3;
  ensureSpace(document, document.heightOfString(cleaned, { width: contentWidth(document), align: 'left' }) + before + after + 4);
  document.moveDown(before / 12);
  document.font('Helvetica-Bold').fontSize(size).text(cleaned, { width: contentWidth(document), align: 'left' });
  document.moveDown(after / 12);
}

function renderParagraph(document: PdfDoc, text: string): void {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    document.moveDown(0.35);
    return;
  }

  const height = document.heightOfString(cleaned, {
    width: contentWidth(document),
    align: 'left',
    lineGap: 2
  });
  ensureSpace(document, height + 4);
  document.font('Helvetica').fontSize(BODY_FONT).lineGap(2).text(cleaned, {
    width: contentWidth(document),
    align: 'left',
    lineBreak: true,
    paragraphGap: 3
  });
}

function renderListItem(document: PdfDoc, prefix: string, text: string): void {
  const cleaned = normalizeText(text);
  const width = contentWidth(document) - 14;
  const height = document.heightOfString(`${prefix} ${cleaned}`, {
    width,
    indent: 0,
    lineGap: 2
  });
  ensureSpace(document, height + 3);
  document.font('Helvetica').fontSize(BODY_FONT).text(`${prefix} ${cleaned}`, {
    width,
    indent: 10,
    lineGap: 2,
    paragraphGap: 1
  });
}

function renderCodeBlock(document: PdfDoc, lines: string[]): void {
  const text = normalizeText(lines.join('\n'));
  const width = contentWidth(document);
  const height = document.heightOfString(text || ' ', {
    width: width - 12,
    lineGap: 1,
    font: 'Courier'
  });
  const boxHeight = height + 14;
  ensureSpace(document, boxHeight + 4);
  const x = document.x;
  const y = document.y;
  document.roundedRect(x, y, width, boxHeight, 3).fillAndStroke('#f5f7fb', '#d4d9e2');
  document.fillColor('#2a3142').font('Courier').fontSize(8.5).text(text, x + 6, y + 6, {
    width: width - 12,
    lineGap: 1
  });
  document.fillColor('black');
  document.moveDown((boxHeight + 4) / 12);
}

function renderTable(document: PdfDoc, rows: string[][]): void {
  const normalizedRows = rows.map((row) => row.map((cell) => normalizeText(cell)));
  if (!normalizedRows.length) {
    return;
  }

  const columnCount = Math.max(...normalizedRows.map((row) => row.length));
  const tableRows = normalizedRows.map((row) => {
    while (row.length < columnCount) row.push('');
    return row;
  });

  const widths = computeTableColumnWidths(document, tableRows);
  const x = document.x;
  const tableWidth = widths.reduce((sum, value) => sum + value, 0);
  const padding = 4;
  const lineGap = 1.2;

  for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex += 1) {
    const row = tableRows[rowIndex];
    const isHeader = rowIndex === 0;
    const cellHeights = row.map((cell, cellIndex) =>
      document.heightOfString(cell || ' ', {
        width: widths[cellIndex] - padding * 2,
        lineGap
      })
    );
    const rowHeight = Math.max(...cellHeights) + padding * 2;

    ensureSpace(document, rowHeight + 4);
    const y = document.y;

    if (isHeader) {
      document.rect(x, y, tableWidth, rowHeight).fillAndStroke('#e8eef7', '#9fb4d1');
    } else {
      document.rect(x, y, tableWidth, rowHeight).stroke('#cbd5e1');
    }

    let cellX = x;
    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const cellText = row[cellIndex];
      const cellWidth = widths[cellIndex];
      if (cellIndex > 0) {
        document.moveTo(cellX, y).lineTo(cellX, y + rowHeight).stroke('#cbd5e1');
      }

      document
        .fillColor('black')
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(TABLE_FONT)
        .text(cellText, cellX + padding, y + padding, {
          width: cellWidth - padding * 2,
          lineGap
        });
      cellX += cellWidth;
    }

    document.moveTo(x, y + rowHeight).lineTo(x + tableWidth, y + rowHeight).stroke('#cbd5e1');
    document.y = y + rowHeight + 2;
  }
}

function computeTableColumnWidths(document: PdfDoc, rows: string[][]): number[] {
  const columnCount = Math.max(...rows.map((row) => row.length));
  const available = contentWidth(document);
  const weights = new Array(columnCount).fill(1);

  for (const row of rows) {
    for (let index = 0; index < columnCount; index += 1) {
      const cell = row[index] ?? '';
      weights[index] = Math.max(weights[index], Math.min(8, Math.ceil(cell.length / 18)));
    }
  }

  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const minWidth = 78;
  const maxWidth = 220;
  const widths = weights.map((weight) => Math.max(minWidth, Math.min(maxWidth, Math.floor((available * weight) / totalWeight))));
  const total = widths.reduce((sum, value) => sum + value, 0);
  if (total !== available) {
    widths[widths.length - 1] += available - total;
  }
  return widths;
}

async function renderImage(document: PdfDoc, altText: string, imageRef: string, baseDir: string): Promise<void> {
  const resolvedImagePath = await resolveMarkdownImagePath(baseDir, imageRef);
  const cleanedAlt = normalizeText(altText);
  if (!resolvedImagePath) {
    renderParagraph(document, `[image unavailable: ${cleanedAlt || path.basename(imageRef)}]`);
    return;
  }

  const spaceNeeded = IMAGE_MAX_HEIGHT + (cleanedAlt ? 20 : 8);
  ensureSpace(document, spaceNeeded);
  try {
    document.image(resolvedImagePath, {
      fit: [IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT],
      align: 'center',
      valign: 'center'
    });
    if (cleanedAlt) {
      document.moveDown(0.15);
      document.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4b5563').text(cleanedAlt, {
        align: 'center',
        width: contentWidth(document)
      });
      document.fillColor('black');
    }
    document.moveDown(0.4);
  } catch {
    renderParagraph(document, `[image unavailable: ${cleanedAlt || path.basename(resolvedImagePath)}]`);
  }
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let paragraphBuffer: string[] = [];
  let codeBuffer: string[] | null = null;
  let orderedIndex = 1;

  const flushParagraph = (): void => {
    if (!paragraphBuffer.length) {
      return;
    }
    blocks.push({ type: 'paragraph', text: paragraphBuffer.join(' ') });
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trimEnd();
    const normalized = trimmed.trim();

    if (codeBuffer) {
      if (normalized.startsWith('```')) {
        blocks.push({ type: 'code', lines: codeBuffer });
        codeBuffer = null;
      } else {
        codeBuffer.push(line);
      }
      continue;
    }

    if (normalized.startsWith('```')) {
      flushParagraph();
      codeBuffer = [];
      continue;
    }

    if (!normalized) {
      flushParagraph();
      orderedIndex = 1;
      continue;
    }

    if (isMarkdownTableRow(normalized) && isMarkdownTableSeparator(lines[index + 1]?.trim() ?? '')) {
      flushParagraph();
      const tableRows: string[][] = [splitMarkdownTableRow(normalized)];
      index += 2;
      while (index < lines.length) {
        const nextLine = lines[index].trim();
        if (!isMarkdownTableRow(nextLine)) {
          index -= 1;
          break;
        }
        tableRows.push(splitMarkdownTableRow(nextLine));
        index += 1;
      }
      blocks.push({ type: 'table', rows: tableRows });
      orderedIndex = 1;
      continue;
    }

    const imageMatch = normalized.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      blocks.push({ type: 'image', altText: imageMatch[1], ref: imageMatch[2] });
      orderedIndex = 1;
      continue;
    }

    const headingMatch = normalized.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2]
      });
      orderedIndex = 1;
      continue;
    }

    const bulletMatch = normalized.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({ type: 'bullet', text: bulletMatch[1] });
      orderedIndex = 1;
      continue;
    }

    const orderedMatch = normalized.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      blocks.push({ type: 'ordered', index: Number(orderedMatch[1]) || orderedIndex, text: orderedMatch[2] });
      orderedIndex += 1;
      continue;
    }

    if (normalized.startsWith('>')) {
      flushParagraph();
      blocks.push({ type: 'paragraph', text: normalized.replace(/^>\s?/, '') });
      orderedIndex = 1;
      continue;
    }

    paragraphBuffer.push(normalized);
  }

  flushParagraph();
  if (codeBuffer && codeBuffer.length) {
    blocks.push({ type: 'code', lines: codeBuffer });
  }
  return blocks;
}

function isMarkdownTableRow(value: string): boolean {
  return value.startsWith('|') && value.endsWith('|') && value.includes('|');
}

function isMarkdownTableSeparator(value: string): boolean {
  if (!isMarkdownTableRow(value)) {
    return false;
  }

  const cells = splitMarkdownTableRow(value);
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(row: string): string[] {
  return row
    .slice(1, -1)
    .split('|')
    .map((cell) => normalizeText(cell.trim()));
}

function contentWidth(document: PdfDoc): number {
  return document.page.width - document.page.margins.left - document.page.margins.right;
}

function ensureSpace(document: PdfDoc, height: number): void {
  const bottomLimit = document.page.height - document.page.margins.bottom;
  if (document.y + height > bottomLimit) {
    document.addPage();
  }
}

function normalizeText(value: string): string {
  const candidates = [value, decodeMojibake(value)];
  const cleaned = candidates
    .map((candidate) =>
      candidate
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trimEnd()
    )
    .sort((left, right) => scoreText(left) - scoreText(right));
  return cleaned[0] ?? value;
}

function decodeMojibake(value: string): string {
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

function scoreText(value: string): number {
  return ['â€', 'Ã', 'Â', '?'].reduce((score, fragment) => score + (value.includes(fragment) ? 1 : 0), 0);
}

async function resolveMarkdownImagePath(baseDir: string, imageRef: string): Promise<string | undefined> {
  if (/^https?:\/\//i.test(imageRef)) {
    return undefined;
  }

  const candidate = path.isAbsolute(imageRef) ? imageRef : path.resolve(baseDir, imageRef);
  try {
    await access(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}
