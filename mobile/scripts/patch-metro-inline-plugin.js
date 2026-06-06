const fs = require('node:fs');
const path = require('node:path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'metro-transform-plugins',
  'src',
  'inline-plugin.js'
);

const marker = `if (
          path.parentPath?.isAssignmentExpression() &&
          path.key === "left"
        ) {`;
const anchor = `if (!state.opts.dev && isDev(path.node, path.parent, path.scope)) {`;
const injection = `if (
          path.parentPath?.isAssignmentExpression() &&
          path.key === "left"
        ) {
          return;
        }
        ${anchor}`;

if (!fs.existsSync(targetPath)) {
  console.warn(`[patch-metro-inline-plugin] Skipped: ${targetPath} not found.`);
  process.exit(0);
}

const source = fs.readFileSync(targetPath, 'utf8');

if (source.includes(marker)) {
  console.log('[patch-metro-inline-plugin] Already applied.');
  process.exit(0);
}

if (!source.includes(anchor)) {
  console.error('[patch-metro-inline-plugin] Failed: expected anchor not found.');
  process.exit(1);
}

const patched = source.replace(anchor, injection);
fs.writeFileSync(targetPath, patched, 'utf8');
console.log('[patch-metro-inline-plugin] Applied.');
