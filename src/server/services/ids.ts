/**
 * Sequential, readable IDs.
 *
 * Must be called inside a transaction so two concurrent writes cannot take the
 * same number. Counters are never rewound: reusing an ID would make the audit
 * trail ambiguous.
 */
import { db } from '../db/index.ts';
import { ID_PREFIX, ID_PAD } from '../../shared/constants.ts';

export type IdKind = keyof typeof ID_PREFIX;

export function nextId(kind: IdKind): string {
  const row = db()
    .prepare('UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value')
    .get(kind) as { value: number } | undefined;

  if (!row) throw new Error(`Unknown counter: ${kind}`);
  return `${ID_PREFIX[kind]}-${String(row.value).padStart(ID_PAD[kind], '0')}`;
}
