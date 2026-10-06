import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Parse the target database name and hosts out of a MongoDB connection string.
 * Supports both `mongodb://` and `mongodb+srv://` and multi-host URIs.
 */
export const getTargetDbInfo = (uri = process.env.MONGO_URI) => {
  if (!uri) {
    return { dbName: null, hosts: [] };
  }

  const withoutProtocol = String(uri).replace(/^mongodb(\+srv)?:\/\//, '');
  const afterCredentials = withoutProtocol.includes('@')
    ? withoutProtocol.slice(withoutProtocol.indexOf('@') + 1)
    : withoutProtocol;

  const [hostsAndDb] = afterCredentials.split('?');
  const slashIndex = hostsAndDb.indexOf('/');
  const hostsPart = slashIndex === -1 ? hostsAndDb : hostsAndDb.slice(0, slashIndex);
  const dbName = slashIndex === -1 ? null : hostsAndDb.slice(slashIndex + 1);

  const hosts = hostsPart
    .split(',')
    .map((entry) => entry.replace(/:\d+$/, '').trim())
    .filter(Boolean);

  return { dbName, hosts };
};

const prompt = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });

/**
 * Guard destructive database scripts.
 *
 * Aborts when the configured target is the production database (matched by
 * `PROD_MONGO_DB`, default "psog", or `NODE_ENV=production`) unless the caller
 * explicitly opts in with `ALLOW_PROD_DESTRUCTIVE=1`.
 *
 * For any target it prints the DB/hosts and requires an interactive "yes"
 * confirmation, or the `--yes` flag / `ALLOW_DESTRUCTIVE=1` env var.
 */
export const assertSafeDestructiveTarget = async ({
  scriptName = 'script',
  action = 'modify data',
} = {}) => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error(`[${scriptName}] FATAL: MONGO_URI is not set (check backend/.env).`);
    process.exit(1);
  }

  const { dbName, hosts } = getTargetDbInfo(uri);
  const prodDb = process.env.PROD_MONGO_DB || 'psog';
  const isProdByEnv = process.env.NODE_ENV === 'production';
  const isProdByName = dbName === prodDb;
  const allowProd = process.env.ALLOW_PROD_DESTRUCTIVE === '1';

  console.log(`\n[${scriptName}] Target database: ${dbName || '(default)'} @ ${hosts.join(', ') || '(unknown host)'}`);

  if ((isProdByEnv || isProdByName) && !allowProd) {
    console.error(`\n[${scriptName}] ABORTED: refusing to ${action} on the production database.`);
    if (isProdByName) {
      console.error(`  - Target "${dbName}" matches PROD_MONGO_DB="${prodDb}".`);
    }
    if (isProdByEnv) {
      console.error('  - NODE_ENV=production is set.');
    }
    console.error('  If you are absolutely sure, set ALLOW_PROD_DESTRUCTIVE=1 to override.');
    process.exit(1);
  }

  const autoConfirm = process.argv.includes('--yes') || process.env.ALLOW_DESTRUCTIVE === '1';
  if (!autoConfirm) {
    if (!process.stdin.isTTY) {
      console.error(
        `\n[${scriptName}] Non-interactive session. Re-run with --yes (or ALLOW_DESTRUCTIVE=1) to confirm ${action}.`
      );
      process.exit(1);
    }
    const answer = await prompt(`Type "yes" to confirm you want to ${action} on "${dbName}": `);
    if (String(answer).trim().toLowerCase() !== 'yes') {
      console.error(`[${scriptName}] Aborted by user.`);
      process.exit(1);
    }
  }

  console.log(`[${scriptName}] Confirmed. Proceeding...\n`);
};

export default assertSafeDestructiveTarget;
