const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { loadFunctions, projectRoot, readIndexHtml, readInlineScript } = require('./helpers/aspenTestUtils');

function serveProject() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const requestPath = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';
    const target = path.resolve(projectRoot, requestPath);
    if (!target.startsWith(projectRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      const contentType = ext === '.html' ? 'text/html' : ext === '.jpg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': contentType });
      res.end(data);
    });
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test('index page exposes the polished UI controls and serves image assets', async t => {
  const { server, baseUrl } = await serveProject();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/index.html`);
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<img class="logo" src="docs\/dice_logo\.png" alt="Aspen logo">/);
  assert.match(html, /<img class="welcome-icon" src="docs\/dice_logo\.png" alt="Aspen logo">/);
  assert.match(html, /id="searchToggleBtn"/);
  assert.match(html, /id="densityToggle"/);
  assert.match(html, /id="sidebarCollapseBtn"/);
  assert.match(html, /id="hudCollapseBtn"/);
  assert.match(html, /id="storySummary"/);
  assert.match(html, /id="updateSummaryBtn"/);
  assert.match(html, /Story Summary/);
  assert.match(html, /Update Summary/);
  assert.match(html, /id="turnTracker"/);
  assert.match(html, /GM Scene/);
  assert.match(html, /Your Action/);
  assert.match(html, /AI Action/);
  assert.match(html, /Resolution/);

  const logoResponse = await fetch(`${baseUrl}/docs/dice_logo.png`);
  assert.equal(logoResponse.status, 200);
  assert.match(logoResponse.headers.get('content-type') || '', /image\/png/);

  const script = readInlineScript();
  assert.match(script, /function toggleStorySearch/);
  assert.match(script, /function applySidebarCollapse/);
  assert.match(script, /function applyHudCollapse/);
  assert.match(script, /function updateStorySummary/);
  assert.match(script, /story_summary/);
});

test('README screenshot asset exists and is linked from the quick start area', () => {
  const html = readIndexHtml();
  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');

  assert.match(readme, /## Quick Start[\s\S]*!\[Aspen chat interface\]\(docs\/aspen_screenshot\.jpg\)[\s\S]*## API Setup/);
  assert.ok(fs.existsSync(path.join(projectRoot, 'docs', 'aspen_screenshot.jpg')));
  assert.match(html, /docs\/dice_logo\.png/);
});

test('story search does not reselect text on every input while open', () => {
  let focusCount = 0;
  let selectCount = 0;
  let filterCount = 0;
  const topbarSearchEl = {
    open: false,
    classList: {
      contains(cls) {
        return cls === 'open' && topbarSearchEl.open;
      },
      toggle(cls, value) {
        if (cls === 'open') topbarSearchEl.open = value;
      }
    }
  };
  const logSearchEl = {
    value: 'ab',
    focus() {
      focusCount++;
    },
    select() {
      selectCount++;
    }
  };
  const searchToggleBtn = {
    setAttribute() {},
    classList: {
      toggle() {}
    }
  };
  const context = loadFunctions(['toggleStorySearch'], {
    topbarSearchEl,
    logSearchEl,
    searchToggleBtn,
    state: { logSearch: 'ab' },
    applyLogFilter() {
      filterCount++;
    }
  });

  context.toggleStorySearch(true);
  assert.equal(topbarSearchEl.open, true);
  assert.equal(focusCount, 1);
  assert.equal(selectCount, 1);

  context.toggleStorySearch(true);
  assert.equal(focusCount, 1);
  assert.equal(selectCount, 1);

  context.toggleStorySearch(false);
  assert.equal(logSearchEl.value, '');
  assert.equal(filterCount, 1);
});
