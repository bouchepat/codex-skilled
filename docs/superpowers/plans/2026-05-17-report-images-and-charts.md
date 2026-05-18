# Report Images and Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let research reports automatically include relevant web images, and add a chart-generation skill so data-heavy reports can generate professional graphics.

**Architecture:** The runner will own report media materialization. It will scan the generated markdown for image references, download remote figures into the session output folder, rewrite the markdown to local relative asset paths, and pass that markdown to the PDF renderer. A separate chart skill will teach the agent how to generate chart assets into the session outputs directory using the Python toolchain baked into the agent images.

**Tech Stack:** Node.js 22, TypeScript, `pdfkit`, built-in `fetch`, Python 3, `matplotlib`, `pandas`, `numpy`.

---

### Task 1: Add report media materialization in the runner

**Files:**
- Create: `runner/src/report-assets.ts`
- Modify: `runner/src/agent-runner.ts`
- Modify: `runner/src/pdf-report.ts`
- Test: `runner/src/report-assets.test.ts`
- Test: `runner/src/pdf-report.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('materializeReportAssets downloads remote images into outputs/assets and rewrites markdown', async () => {
  const rewritten = await materializeReportAssets(
    '![Example figure](https://example.com/chart.png)\n',
    sessionPath,
    outputsPath,
    fetchStub
  );

  assert.match(rewritten, /\]\(\.\/assets\/example-chart\.png\)/);
  assert.equal(await stat(path.join(outputsPath, 'assets', 'example-chart.png')), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd runner && npm test -- --run report-assets.test.js`
Expected: FAIL because `materializeReportAssets` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export async function materializeReportAssets(markdown: string, outputsPath: string): Promise<string> {
  // 1. Find markdown image syntax.
  // 2. Download http(s) images into outputs/assets/.
  // 3. Rewrite remote URLs to relative local asset paths.
  // 4. Return the rewritten markdown.
}
```

- [ ] **Step 4: Update the runner to use the rewritten markdown**

```ts
const preparedMarkdown = await materializeReportAssets(finalOutput, outputsRootPath);
await writeFile(hostMarkdownAbsolutePath, preparedMarkdown, 'utf8');
await renderMarkdownToPdf(preparedMarkdown, hostPdfAbsolutePath, `${request.appName} Report`);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd runner && npm test`
Expected: all runner tests pass.

- [ ] **Step 6: Commit**

```bash
git add runner/src/report-assets.ts runner/src/agent-runner.ts runner/src/pdf-report.ts runner/src/report-assets.test.ts runner/src/pdf-report.test.ts
git commit -m "feat: embed report images in generated reports"
```

### Task 2: Add a chart-generation skill and bake in chart tooling

**Files:**
- Create: `runner/skills/chart-generation/SKILL.md`
- Modify: `runner/Dockerfile.market-research-codex`
- Modify: `runner/Dockerfile.market-research-claude`
- Test: `runner/skills/chart-generation/SKILL.md` (manual smoke via a chart job)

- [ ] **Step 1: Write the skill doc**

```md
# chart-generation

## Purpose
Generate report-ready charts and graphics for research deliverables.

## Required behavior
- Use Python with matplotlib and pandas for charts.
- Write image assets into the session outputs folder.
- Prefer PNG for compatibility and PDF embedding.
- Use clear titles, labels, and legends.

## Output convention
- Save charts under `outputs/figures/` with descriptive names.
```

- [ ] **Step 2: Install chart dependencies in both agent images**

```dockerfile
RUN mkdir -p /workspace /opt/agent-cli/bin \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git poppler-utils python-is-python3 python3 python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m pip install --no-cache-dir --break-system-packages reportlab pdfplumber pypdf matplotlib pandas numpy \
  && npm install -g @openai/codex@latest
```

- [ ] **Step 3: Make the chart skill available to report jobs**

```md
Approved skills:
- market-research
- pdf
- chart-generation
```

- [ ] **Step 4: Smoke-test chart output**

Run a minimal job that asks for a chart and verify a PNG appears in `outputs/figures/` and is embedded in the report.

- [ ] **Step 5: Commit**

```bash
git add runner/skills/chart-generation/SKILL.md runner/Dockerfile.market-research-codex runner/Dockerfile.market-research-claude
git commit -m "feat: add chart generation skill and tooling"
```

### Task 3: Update market-research prompting to prefer relevant figures automatically

**Files:**
- Modify: `runner/skills/market-research/SKILL.md`
- Modify: `runner/src/cli-command.ts`
- Test: `runner/src/cli-command.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('buildAgentPrompt asks for relevant figures and source-linked visuals', () => {
  const prompt = buildAgentPrompt(...);
  assert.match(prompt, /relevant figures/i);
  assert.match(prompt, /web images/i);
});
```

- [ ] **Step 2: Update the prompt guidance**

```md
- Include relevant web-sourced figures when they materially improve the report.
- Prefer up to 3 illustrations that add evidence, context, or comparison value.
- Put figure captions and source links near the image.
- Use the chart-generation skill for numeric trends or comparisons.
```

- [ ] **Step 3: Run the tests to verify prompt text is present**

Run: `cd runner && npm test`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add runner/skills/market-research/SKILL.md runner/src/cli-command.ts runner/src/cli-command.test.ts
git commit -m "feat: guide reports toward figures and charts"
```

### Task 4: Rebuild and verify the full stack

**Files:**
- No new files.

- [ ] **Step 1: Rebuild the agent images**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml build market-research-codex-image market-research-claude-image`

- [ ] **Step 2: Recreate the app stack**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backend runner frontend`

- [ ] **Step 3: Run a real report smoke**

Run a report that references a web image and verify the markdown output contains a local `./assets/...` figure path and the PDF includes the image.

- [ ] **Step 4: Verify**

Run: `cd runner && npm test`
Run: `cd backend && npm run build`
Run: `cd frontend && npm run build`
