'use strict';
// 每个测试文件在独立进程中运行，避免共享内存数据库相互干扰，
// 同时用 --test-isolation=none 规避子进程管道在受限环境下的 EPERM。
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();

let failed = 0;
for (const f of files) {
  console.log('\n========== ' + f + ' ==========');
  const r = spawnSync(process.execPath, ['--test', '--test-isolation=none', path.join(dir, f)], {
    stdio: 'inherit',
  });
  if (r.status !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} 个测试文件失败`);
  process.exit(1);
}
console.log('\n全部测试通过');
