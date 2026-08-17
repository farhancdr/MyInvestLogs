#!/usr/bin/env node
/**
 * Pulls maintainer updates into a copy made from the template.
 *
 * A template-created repository shares no history with the template, so a
 * plain `git pull` fails: there is no common ancestor. The first update needs
 * --allow-unrelated-histories; every one after that behaves normally.
 *
 * Your records are never part of an update. The database is copied aside
 * before the merge and restored afterwards, so whatever the incoming version
 * of data/tracker.db contains, yours is what remains.
 *
 * Plain .mjs with no imports beyond Node built-ins, so it runs before any
 * install has happened.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';

const TEMPLATE = process.env.TEMPLATE_REMOTE
  ?? 'https://github.com/farhancdr/MyInvestLogs.git';
const DB = 'data/tracker.db';
const BACKUP = 'data/.tracker.db.pre-update';

const git = (args, allowFail = false) => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')}\n${r.stderr || r.stdout}`);
  }
  return { code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

const say = (...lines) => console.log(lines.join('\n'));

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  say('This is not a git repository, so there is nothing to update.');
  process.exit(1);
}

// Uncommitted work would be swept into the merge, which is nobody's intent.
if (git(['status', '--porcelain']).out) {
  say(
    'You have uncommitted changes. Save them first, then run this again:',
    '',
    '  git add -A && git commit -m "my changes"',
    '',
  );
  process.exit(1);
}

const remotes = git(['remote']).out.split('\n').filter(Boolean);
if (!remotes.includes('upstream')) {
  say(`Adding the template as "upstream" (${TEMPLATE})`);
  git(['remote', 'add', 'upstream', TEMPLATE]);
}

say('Fetching the latest version…');
git(['fetch', '--quiet', 'upstream']);

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).out;
const behind = git(['rev-list', '--count', `HEAD..upstream/main`], true);
if (behind.code === 0 && behind.out === '0') {
  say('Already up to date. Nothing to do.');
  process.exit(0);
}

if (existsSync(DB)) copyFileSync(DB, BACKUP);

/*
 * Two flags carry this, and both are needed because of how template copies
 * work.
 *
 * --allow-unrelated-histories: a template copy shares no ancestor with the
 * template, so git refuses a plain merge.
 *
 * -X theirs: with no common ancestor git has no way to tell "the user edited
 * this" from "the user simply has the older version". Every file the
 * maintainer changed would conflict, even ones nobody touched. Favouring the
 * incoming version makes the ordinary update pass cleanly; the files it
 * replaces are listed below, and nothing is lost because your own commits
 * remain in git history.
 */
const replaced = git(['diff', '--name-only', 'HEAD', 'upstream/main'], true)
  .out.split('\n').filter((f) => f && f !== DB);

const merge = git(
  ['merge', 'upstream/main', '--allow-unrelated-histories', '-X', 'theirs',
    '-m', 'chore: update from template'],
  true,
);

if (merge.code !== 0) {
  // Anything left conflicting after -X theirs needs a human.
  const stuck = git(['diff', '--name-only', '--diff-filter=U'], true)
    .out.split('\n').filter(Boolean);

  if (stuck.length === 1 && stuck[0] === DB) {
    git(['checkout', '--ours', '--', DB], true);
    git(['add', '--', DB], true);
    git(['commit', '--no-edit'], true);
  } else {
    git(['merge', '--abort'], true);
    if (existsSync(BACKUP)) { copyFileSync(BACKUP, DB); unlinkSync(BACKUP); }
    say(
      '',
      'The update could not be applied automatically, so nothing was changed:',
      ...stuck.map((f) => `  ${f}`),
      '',
      'Your records are untouched. Ask for help, quoting the file names above.',
      '',
    );
    process.exit(1);
  }
}

// Restore unconditionally: your records win regardless of what arrived.
if (existsSync(BACKUP)) {
  copyFileSync(BACKUP, DB);
  unlinkSync(BACKUP);
  const changed = git(['status', '--porcelain', '--', DB], true).out;
  if (changed) {
    git(['add', '--', DB], true);
    git(['commit', '--no-edit', '-m', 'chore: keep local records after update'], true);
  }
}

if (replaced.length) {
  say(
    '',
    `Updated ${replaced.length} file${replaced.length === 1 ? '' : 's'}:`,
    ...replaced.slice(0, 12).map((f) => `  ${f}`),
    ...(replaced.length > 12 ? [`  …and ${replaced.length - 12} more`] : []),
    '',
    'If you had edited any of those, your version is still in git history.',
  );
}

say(
  '',
  'Done. Two things left:',
  '',
  '  npm install     # in case the update added anything',
  '  npm run app     # any database changes apply automatically on start',
  '',
  `You are on branch "${branch}". Push when you are happy:  git push`,
  '',
);
