import { readFile } from 'node:fs/promises';
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
