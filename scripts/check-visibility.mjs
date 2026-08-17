#!/usr/bin/env node
/**
 * Refuses to commit the database to a public repository.
 *
 * This repo tracks data/tracker.db on purpose: that is how a clone restores
 * your records. The whole arrangement is safe only while the remote is
 * private, and the failure is silent and permanent — once pushed, the data is
 * public and stays in git history even if the file is deleted later.
 *
 * Deliberately plain .mjs with no imports beyond Node built-ins: a git hook
 * has to work before `npm install` has ever run.
 *
 *   node scripts/check-visibility.mjs            check and report
 *   node scripts/check-visibility.mjs --staged   only if the db is staged (hook)
 */
import { execFileSync } from 'node:child_process';

const DB_PATH = 'data/tracker.db';
const stagedMode = process.argv.includes('--staged');

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const say = (lines) => console.log(lines.join('\n'));

if (stagedMode) {
  const staged = run('git', ['diff', '--cached', '--name-only']).split('\n');
  if (!staged.includes(DB_PATH)) process.exit(0);
}

const tracked = run('git', ['ls-files', DB_PATH]) === DB_PATH;
if (!tracked) {
  say([`✓ ${DB_PATH} is not tracked by git — nothing to leak.`]);
  process.exit(0);
}

const remote = run('git', ['remote', 'get-url', 'origin']);
if (!remote) {
  say([
    `• ${DB_PATH} is tracked, but no remote is configured yet.`,
    '  Make sure the repository you push to is PRIVATE.',
  ]);
  process.exit(0);
}

// Strip a trailing .git rather than excluding dots: repository names may
// legitimately contain them, and excluding them silently mangles the slug.
const match = remote.match(/github\.com[:/](.+?)(?:\.git)?\/?$/);
if (!match) {
  say([
    `• ${DB_PATH} is tracked and the remote is not GitHub, so visibility cannot be checked.`,
    '  Confirm the remote is private before pushing.',
  ]);
  process.exit(0);
}

const slug = match[1];
const visibility = run('gh', ['api', `repos/${slug}`, '--jq', '.visibility']);

if (!visibility) {
  say([
    `• Cannot determine whether ${slug} is private (GitHub CLI missing or not authenticated).`,
    `  ${DB_PATH} is tracked. Verify the repository is private before pushing.`,
  ]);
  process.exit(0);
}

if (visibility.toLowerCase() === 'public') {
  if (process.env.ALLOW_PUBLIC_DB === '1') {
    say([`! Committing ${DB_PATH} to PUBLIC repo ${slug} — allowed via ALLOW_PUBLIC_DB=1.`]);
    process.exit(0);
  }

  say([
    '',
    '  ✖ BLOCKED — this would publish your financial records.',
    '',
    `  ${slug} is PUBLIC and ${DB_PATH} is tracked by git.`,
    '  Committing it publishes every business, amount and date it contains,',
    '  and git keeps that history even if you delete the file afterwards.',
    '',
    '  Pick one:',
    '',
    `    1. Make the repository private   gh repo edit ${slug} --visibility private`,
    '    2. Stop tracking the database    npm run db:untrack',
    '    3. You genuinely mean it         ALLOW_PUBLIC_DB=1 git commit …',
    '',
  ]);
  process.exit(1);
}

say([`✓ ${slug} is ${visibility} — safe to track ${DB_PATH}.`]);
