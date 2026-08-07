const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('landing page loads the demo video script so the hero video can appear', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<script[^>]*src="demo-video\.js"/);
  assert.match(html, /id="demo-video"/);
});
