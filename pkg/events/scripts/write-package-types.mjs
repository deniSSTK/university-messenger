import { writeFile } from 'node:fs/promises';

for (const [folder, type] of [
  ['esm', 'module'],
  ['cjs', 'commonjs'],
]) {
  const target = new URL(`../dist/${folder}/package.json`, import.meta.url);
  await writeFile(target, `${JSON.stringify({ type })}\n`);
}
