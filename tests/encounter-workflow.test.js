import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('actual publication block commits a Max-only update and is a no-op when unchanged', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'encounter-publish-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const remote = join(directory, 'remote.git'), checkout = join(directory, 'checkout');
  const run = (command, args, cwd = directory) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_REF_NAME: 'main' } });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout.trim();
  };
  run('git', ['init', '--bare', remote]);
  run('git', ['init', '-b', 'main', checkout]);
  run('git', ['config', 'user.name', 'Test'], checkout);
  run('git', ['config', 'user.email', 'test@example.test'], checkout);
  await mkdir(join(checkout, 'public/data'), { recursive: true });
  for (const name of ['costume-encounters', 'raid-rotations', 'max-rotations']) await writeFile(join(checkout, `public/data/${name}.json`), '{}\n');
  run('git', ['add', '.'], checkout);
  run('git', ['commit', '-m', 'Initial data'], checkout);
  run('git', ['remote', 'add', 'origin', remote], checkout);
  run('git', ['push', '-u', 'origin', 'main'], checkout);
  const workflow = await readFile(new URL('../.github/workflows/update-costumes.yml', import.meta.url), 'utf8');
  const script = workflow.split('      - name: Publish encounter data\n        run: |\n')[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
  assert.ok(script.includes('git push'));
  await writeFile(join(checkout, 'public/data/max-rotations.json'), '{"rotations":[]}\n');
  run('bash', ['-e', '-c', script], checkout);
  assert.equal(run('git', ['status', '--porcelain'], checkout), '');
  assert.equal(run('git', ['rev-parse', 'main'], checkout), run('git', ['rev-parse', 'refs/heads/main'], remote));
  const head = run('git', ['rev-parse', 'HEAD'], checkout);
  run('bash', ['-e', '-c', script], checkout);
  assert.equal(run('git', ['rev-parse', 'HEAD'], checkout), head);
});
