// Only used in a fresh Actions checkout after a failed candidate sync/build.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const previous = execFileSync('git', ['show', 'HEAD:pricing.json'], { encoding: 'utf8' });
const previousData = JSON.parse(previous);
let status;
try { status = JSON.parse(fs.readFileSync('sync-status.json', 'utf8')); } catch { status = { sources: [] }; }
status.status = 'failed';
status.checkedAt = new Date().toISOString();
status.modelCount = previousData.models.length;
status.sources = [...(status.sources || []), {
  name: '更新流水线', status: 'error', role: '保留已发布数据',
  message: `${process.env.FAILED_STAGE || 'unknown'} 失败，候选价格未发布。详见 ${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || 'billowssun/API-pricing'}/actions/runs/${process.env.GITHUB_RUN_ID || ''}`,
}];
fs.writeFileSync('pricing.json', previous);
fs.writeFileSync('sync-status.json', `${JSON.stringify(status, null, 2)}\n`);
