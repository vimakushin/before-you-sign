import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequest } from '../src/parse.js';
import { recognise } from '../src/known-types.js';
import { notChecked } from '../src/unknowns.js';

// Both requests are the ones used in the other test files: the example from
// the text of EIP-712 and the Permit2 request composed by the project owner.
// Every other input is one of them, changed in one way.
const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const mail = read('eip712-example.json');
const permitSingle = read('permit2-permit-single.json');

const ALWAYS = ['whose-addresses', 'token-genuine', 'after-signing'];

function listFor(text) {
  const parsed = parseRequest(text);
  return notChecked(parsed, recognise(parsed));
}

function changed(text, change) {
  const data = JSON.parse(text);
  change(data);
  return JSON.stringify(data);
}

test('every answer says what was not checked, whatever the request', () => {
  const requests = [
    mail,
    permitSingle,
    changed(permitSingle, (data) => (data.domain.name = 'Other')),
    changed(permitSingle, (data) => delete data.types.EIP712Domain),
    changed(mail, (data) => (data.message = {})),
  ];
  for (const request of requests) {
    assert.deepEqual(listFor(request).slice(0, ALWAYS.length), ALWAYS);
  }
});

test('a type that is not explained adds that the meaning of its fields is not stated', () => {
  assert.deepEqual(listFor(mail), [...ALWAYS, 'meaning-of-fields']);
});

test('a verified Permit2 request adds only the decimals of the token', () => {
  assert.deepEqual(listFor(permitSingle), [...ALWAYS, 'token-decimals']);
});

test('an ERC-2612 permit adds that the token may not do what the standard says', () => {
  const erc2612 = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    domain: { name: 'Any Token', version: '1', chainId: '1', verifyingContract: '0x1111111111111111111111111111111111111111' },
    message: { owner: '0x1111111111111111111111111111111111111111', spender: '0x1111111111111111111111111111111111111111', value: '1', nonce: '0', deadline: '1' },
  });
  assert.deepEqual(listFor(erc2612), [...ALWAYS, 'token-follows-standard', 'token-decimals']);
});

test('answers for a request nested as deep as the parser accepts', () => {
  const nested = changed(mail, (data) => {
    data.types.Mail = [{ name: 'to', type: 'Mail[]' }];
    data.message = 'MESSAGE';
  }).replace('"MESSAGE"', '{"to":['.repeat(700) + ']}'.repeat(700));
  assert.deepEqual(listFor(nested), [...ALWAYS, 'meaning-of-fields']);
});

test('a contract that could not be verified is said so, and its fields are not explained', () => {
  const expected = [...ALWAYS, 'meaning-of-fields', 'contract-not-verified'];
  assert.deepEqual(listFor(changed(permitSingle, (data) => (data.domain.name = 'Other'))), expected);
  assert.deepEqual(listFor(changed(permitSingle, (data) => delete data.types.EIP712Domain)), expected);
});

test('keys outside the type, values that could not be read, and large bare numbers are each listed', () => {
  const undeclared = changed(mail, (data) => (data.message.to.cc = 'Eve'));
  assert.deepEqual(listFor(undeclared), [...ALWAYS, 'meaning-of-fields', 'undeclared-keys']);

  const unread = changed(mail, (data) => delete data.message.contents);
  assert.deepEqual(listFor(unread), [...ALWAYS, 'meaning-of-fields', 'unread-values']);

  // A deadline written as a bare number too large for JavaScript to hold exactly.
  const bare = permitSingle.replace('"sigDeadline": "1790072010"', '"sigDeadline": 9007199254740993');
  assert.notEqual(bare, permitSingle);
  assert.deepEqual(listFor(bare), [...ALWAYS, 'token-decimals', 'bare-large-numbers']);
  // The bare chain id in the EIP-712 example is small enough to be exact.
  assert.ok(!listFor(mail).includes('bare-large-numbers'));
});
