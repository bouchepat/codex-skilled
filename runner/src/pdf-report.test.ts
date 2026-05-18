import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdownToPdf } from './pdf-report.js';

test('renderMarkdownToPdf writes a pdf file', async () => {
  const outputPath = path.join(os.tmpdir(), `codex-skilled-${Date.now()}.pdf`);
  await renderMarkdownToPdf('# Title\n\n- One\n- Two\n\nParagraph.', outputPath, 'Report');

  const header = await readFile(outputPath);
  assert.equal(header.subarray(0, 4).toString('utf8'), '%PDF');
});

test('renderMarkdownToPdf embeds local markdown images when available', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'codex-skilled-image-'));
  const outputPath = path.join(tempDir, 'report.pdf');
  const imagePath = path.join(tempDir, 'figure.png');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==',
    'base64'
  );
  await writeFile(imagePath, png);
  await renderMarkdownToPdf('# Title\n\n![Figure](figure.png)\n', outputPath, 'Report', tempDir);

  const header = await readFile(outputPath);
  assert.equal(header.subarray(0, 4).toString('utf8'), '%PDF');
});
