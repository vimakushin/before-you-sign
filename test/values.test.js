import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequest } from '../src/parse.js';
import { recognise } from '../src/known-types.js';
import { readInteger, largestOf, withDecimals, readAmount, readTime } from '../src/values.js';

// The numbers in this file are composed for the tests and checked by
// arithmetic; none of them is taken from a request a wallet showed. The one
// request used is the owner's Permit2 example (see known-types.test.js).
const permitSingle = parseRequest(
  readFileSync(new URL('./fixtures/permit2-permit-single.json', import.meta.url), 'utf8'),
);
const details = permitSingle.message.find((field) => field.name === 'details').fields;
const field = (name) => details.find((candidate) => candidate.name === name);

test('reads decimal and 0x-hexadecimal integers', () => {
  assert.equal(readInteger('0'), 0n);
  assert.equal(readInteger('007'), 7n);
  assert.equal(readInteger('0xff'), 255n);
  assert.equal(readInteger('0xFF'), 255n);
  assert.equal(readInteger((2n ** 256n - 1n).toString()), 2n ** 256n - 1n);
});

test('reads nothing else as an integer', () => {
  for (const value of ['1e30', '1.5', '-5', '', ' 1', '1 ', '0x', '0b11', '0o7', '1,000', 'abc', true, undefined]) {
    assert.equal(readInteger(value), null, JSON.stringify(value));
  }
});

test('knows the largest number each unsigned type holds', () => {
  assert.equal(largestOf('uint8'), 255n);
  assert.equal(largestOf('uint48'), 281474976710655n);
  assert.equal(largestOf('uint160'), 1461501637330902918203684832716283019655932542975n);
  assert.equal(largestOf('uint256'), 2n ** 256n - 1n);
  assert.equal(largestOf('address'), null);
  assert.equal(largestOf('uint256[]'), null);
});

test('moves the decimal point exactly', () => {
  assert.equal(withDecimals(1000000n, 6), '1');
  assert.equal(withDecimals(1500000n, 6), '1.5');
  assert.equal(withDecimals(1n, 18), '0.000000000000000001');
  assert.equal(withDecimals(0n, 18), '0');
  assert.equal(withDecimals(123n, 0), '123');
  assert.equal(withDecimals(2n ** 256n - 1n, 18).length, 79);
});

test('the same integer is a trillion times apart under the two common guesses', () => {
  const amount = readAmount({ type: 'uint256', value: '1000000' });
  assert.deepEqual(amount, {
    exact: '1000000',
    largest: false,
    assumed: [
      { decimals: 18, amount: '0.000000000001' },
      { decimals: 6, amount: '1' },
    ],
  });
});

test('gives one converted amount once the decimals are stated', () => {
  assert.deepEqual(readAmount({ type: 'uint256', value: '1000000' }, 6), {
    exact: '1000000',
    largest: false,
    amount: '1',
  });
});

test('treats a number of decimals that is not a whole number from 0 to 255 as not stated', () => {
  const amount = { type: 'uint256', value: '5' };
  for (const decimals of ['', null, '6', -1, 1.5, NaN, 256, 1e9, Infinity]) {
    assert.deepEqual(Object.keys(readAmount(amount, decimals)), ['exact', 'largest', 'assumed'], String(decimals));
  }
  assert.equal(readAmount(amount, 0).amount, '5');
  assert.equal(readAmount(amount, 255).amount.length, 257);
});

test('reads an amount only from an unsigned integer that fits its type', () => {
  const address = '0x000000000022d473030f116ddee9f6b43ac78ba3';
  assert.equal(readAmount({ type: 'address', value: address }), null);
  assert.equal(readAmount({ type: 'int256', value: '5' }), null);
  assert.equal(readAmount({ type: 'uint256[]', value: '5' }), null);
  assert.equal(readAmount({ value: '5' }), null);
  assert.equal(readAmount({ type: 'PermitDetails', value: '5', unread: true }), null);
  assert.equal(readAmount({ type: 'uint160', value: (2n ** 256n - 1n).toString() }), null);
});

test('answers only for the integer sizes EIP-712 has', () => {
  for (const type of ['uint0', 'uint7', 'uint257', 'uint264', 'uint0256', 'uint99999999999', 'uint']) {
    assert.equal(largestOf(type), null, type);
    assert.equal(readAmount({ type, value: '0' }), null, type);
    assert.equal(readTime({ type, value: '0' }, 0), null, type);
  }
});

test('marks the largest amount of each type and does not convert it', () => {
  assert.deepEqual(readAmount(field('amount')), {
    exact: '1461501637330902918203684832716283019655932542975',
    largest: true,
  });
  const largest256 = (2n ** 256n - 1n).toString();
  assert.deepEqual(readAmount({ type: 'uint256', value: largest256 }), { exact: largest256, largest: true });
  // The largest uint160 in a uint256 member is a large amount, not the largest.
  assert.equal(readAmount({ type: 'uint256', value: field('amount').value }).largest, false);
  // One less than the largest is not the largest.
  assert.equal(readAmount({ type: 'uint160', value: (2n ** 160n - 2n).toString() }).largest, false);
});

test('says when what gets signed depends on how the wallet reads a bare number', () => {
  const large = '9007199254740993';
  assert.equal(readAmount({ type: 'uint256', value: large, bare: true }).dependsOnWallet, true);
  assert.equal(readTime({ type: 'uint256', value: large, bare: true }, 0).dependsOnWallet, true);
  // The same digits in quotes, and a bare number small enough to be exact, are what they say.
  assert.equal(readAmount({ type: 'uint256', value: large }).dependsOnWallet, undefined);
  assert.equal(readAmount({ type: 'uint256', value: '9007199254740991', bare: true }).dependsOnWallet, undefined);
  // A large number that a JavaScript number holds exactly: 2^60.
  assert.equal(readAmount({ type: 'uint256', value: (2n ** 60n).toString(), bare: true }).dependsOnWallet, undefined);
});

test('does not read an amount written in a notation it does not know', () => {
  assert.equal(readAmount({ type: 'uint256', value: '1e30' }), null);
  assert.equal(readAmount({ type: 'uint256', value: undefined }), null);
});

test('turns seconds into a date and a distance from now', () => {
  // 30 days before the allowance in the example expires.
  const now = 1792662210 - 30 * 24 * 60 * 60;
  assert.deepEqual(readTime(field('expiration'), now), {
    exact: '1792662210',
    largest: false,
    zero: false,
    date: '2026-10-22T09:43:30.000Z',
    fromNow: '2592000',
  });
  assert.equal(readTime(field('expiration'), 1792662211).fromNow, '-1');
  // Date.now() / 1000 has a fraction; it is dropped.
  assert.equal(readTime(field('expiration'), now + 0.75).fromNow, '2592000');
});

test('reports zero and the largest time, and gives no date where none exists', () => {
  assert.deepEqual(readTime({ type: 'uint48', value: '0' }, 100), {
    exact: '0',
    largest: false,
    zero: true,
    date: '1970-01-01T00:00:00.000Z',
    fromNow: '-100',
  });
  const largest48 = readTime({ type: 'uint48', value: '281474976710655' }, 0);
  assert.equal(largest48.largest, true);
  assert.equal(largest48.date, null);
  assert.equal(readTime({ type: 'uint256', value: '8640000000000' }, 0).date, '+275760-09-13T00:00:00.000Z');
  assert.equal(readTime({ type: 'uint256', value: '8640000000001' }, 0).date, null);
  assert.equal(readTime({ type: 'uint256', value: 'soon' }, 0), null);
});

test('zero does different things: it ends a Permit2 allowance at once, and switches off the deadline of a DAI signature', () => {
  const permit2 = recognise(permitSingle);
  assert.deepEqual(permit2.zeroMeans, { allowanceExpiration: 'current-block-only' });
  assert.equal(permit2.largestAmountMeans, 'unlimited');

  const daiTypes = {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Permit: [
      { name: 'holder', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'allowed', type: 'bool' },
    ],
  };
  const dai = recognise(
    parseRequest(
      JSON.stringify({
        types: daiTypes,
        primaryType: 'Permit',
        domain: {
          name: 'Dai Stablecoin',
          version: '1',
          chainId: 1,
          verifyingContract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        },
        message: {},
      }),
    ),
  );
  assert.deepEqual(dai.zeroMeans, { signatureDeadline: 'not-checked' });
  assert.equal(dai.largestAmountMeans, undefined);
});
