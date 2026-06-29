// Unit checks for store credit accounting — focuses on the DIM-5 refund bug
// that the HTTP smoke test can't reach (mock generation never fails).
// Uses an isolated temp store via LISTLIFT_DATA_DIR override is not supported,
// so we run against a unique uid and assert deltas relative to a fresh user.
import { randomUUID } from 'node:crypto';
import { getBalance, consumeCredit, refundCredit, creditPack } from '../lib/store.js';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

// --- free credit: failed generation must restore freeUsed (the bug) ---
{
  const uid = `unit_free_${randomUUID()}`;
  const start = getBalance(uid);
  check('fresh user has 1 free', start.freeRemaining === 1, JSON.stringify(start));

  const spend = consumeCredit(uid);
  check('free consume ok + usedFree', spend.ok && spend.usedFree === true);
  check('after free consume, 0 free remaining', getBalance(uid).freeRemaining === 0);

  // simulate generation failure → refund the SAME bucket that was charged
  refundCredit(uid, { usedFree: spend.usedFree });
  const after = getBalance(uid);
  check('free refund restores freeRemaining to 1', after.freeRemaining === 1, JSON.stringify(after));
  check('user can generate again after free refund', after.canGenerate === true);
}

// --- paid credit: failed generation must restore one paid credit ---
{
  const uid = `unit_paid_${randomUUID()}`;
  creditPack(uid, `sess_${randomUUID()}`); // grant a 10-pack
  consumeCredit(uid); // burn the free one first
  const beforePaid = getBalance(uid);
  check('has 10 paid after pack', beforePaid.paidCredits === 10, JSON.stringify(beforePaid));

  const spend = consumeCredit(uid); // now consumes a paid credit
  check('paid consume ok + not free', spend.ok && spend.usedFree === false);
  check('paid credits drop to 9', getBalance(uid).paidCredits === 9);

  refundCredit(uid, { usedFree: spend.usedFree });
  check('paid refund restores to 10', getBalance(uid).paidCredits === 10);
}

// --- idempotent pack fulfillment still holds ---
{
  const uid = `unit_idem_${randomUUID()}`;
  const sid = `sess_${randomUUID()}`;
  const first = creditPack(uid, sid);
  const second = creditPack(uid, sid);
  check('first fulfill not already fulfilled', first.alreadyFulfilled === false);
  check('second fulfill is idempotent', second.alreadyFulfilled === true && getBalance(uid).paidCredits === 10);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exitCode = fail === 0 ? 0 : 1;
