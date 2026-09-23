const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('post-sync build failure restores published data and records the true failed stage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pricing-failure-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  const previous = { models: [{ id: 'published', input: 2 }] };
  try {
    git('init');
    fs.writeFileSync(path.join(dir, 'pricing.json'), JSON.stringify(previous));
    git('add', 'pricing.json');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
    fs.writeFileSync(path.join(dir, 'pricing.json'), JSON.stringify({ models: [{ id: 'unpublished', input: 999 }] }));
    fs.writeFileSync(path.join(dir, 'sync-status.json'), JSON.stringify({ status: 'healthy', sources: [] }));
    execFileSync(process.execPath, [path.resolve(__dirname, '../scripts/report-sync-failure.cjs')], { cwd: dir, env: { ...process.env, FAILED_STAGE: 'validation-build', GITHUB_RUN_ID: '123' } });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'pricing.json'))), previous);
    const status = JSON.parse(fs.readFileSync(path.join(dir, 'sync-status.json')));
    assert.equal(status.status, 'failed');
    assert.equal(status.modelCount, 1);
    assert.match(status.sources[0].message, /validation-build.*123/);
  } finally {
    // Only this test's uniquely created temporary repository is removed.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
