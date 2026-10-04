import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequest } from '../src/parse.js';
import { recognise } from '../src/known-types.js';
import { notChecked } from '../src/unknowns.js';
import { seaportOrder } from './fixtures/published-types.js';

// Both requests are the ones used in the other test files: the example from
// the text of EIP-712 and the Permit2 request composed by the project owner.
// Every other input is one of them, changed in one way.
const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const mail = read('eip712-example.json');
const permitSingle = read('permit2-permit-single.json');

const ALWAYS = ['whose-addresses', 'token-genuine', 'contract-code', 'address-checksum'];

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

const PERMIT2 = ['network-not-compared', 'prior-approval-of-permit2', 'token-decimals', 'device-clock'];

test('a Permit2 request with the published domain still has its own list', () => {
  assert.deepEqual(listFor(permitSingle), [...ALWAYS, ...PERMIT2]);
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
  assert.deepEqual(listFor(erc2612), [...ALWAYS, 'token-follows-standard', 'token-decimals', 'device-clock']);
});

test('a number or an address that could not be read is listed, whatever the reason', () => {
  const amount = (value) => changed(permitSingle, (data) => (data.message.details.amount = value));
  for (const value of ['abc', '1e30', 1e30, '-5', '']) {
    assert.ok(listFor(amount(value)).includes('unread-values'), JSON.stringify(value));
  }
  const token = changed(permitSingle, (data) => (data.message.details.token = 'hello'));
  assert.ok(listFor(token).includes('unread-values'));
  assert.ok(!listFor(permitSingle).includes('unread-values'));
});

test('a Seaport order mentions decimals unless every item was read and none is a token', () => {
  const order = (...kinds) => {
    const item = (itemType) => ({ itemType, token: '0x1111111111111111111111111111111111111111', identifierOrCriteria: '0', startAmount: '1', endAmount: '1' });
    return JSON.stringify({
      types: {
        ...seaportOrder,
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
      },
      primaryType: 'OrderComponents',
      domain: { name: 'Seaport', version: '1.6', chainId: '1', verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395' },
      message: { offer: kinds.map(item), consideration: [] },
    });
  };
  for (const kinds of [['1'], [1], ['01'], ['0x1'], ['2', '1'], [' 1'], ['2', 'one']]) {
    assert.ok(listFor(order(...kinds)).includes('token-decimals'), JSON.stringify(kinds));
  }
  for (const kinds of [['2'], ['0', '3'], ['4', '5'], []]) {
    assert.ok(!listFor(order(...kinds)).includes('token-decimals'), JSON.stringify(kinds));
  }
});

test('a type that is not explained still says when its domain type is not declared', () => {
  const text = changed(mail, (data) => delete data.types.EIP712Domain);
  assert.deepEqual(listFor(text), [...ALWAYS, 'meaning-of-fields', 'contract-not-established']);
});

test('answers for a request nested as deep as the parser accepts', () => {
  const nested = changed(mail, (data) => {
    data.types.Mail = [{ name: 'to', type: 'Mail[]' }];
    data.message = 'MESSAGE';
  }).replace('"MESSAGE"', '{"to":['.repeat(700) + ']}'.repeat(700));
  assert.deepEqual(listFor(nested), [...ALWAYS, 'meaning-of-fields']);
});

test('an ERC-2612 permit with a domain EIP-712 does not allow is not said to be off a list: there is no list', () => {
  const text = changed(permitSingle, (data) => {
    data.primaryType = 'Permit';
    data.types = {
      EIP712Domain: [{ name: 'owner', type: 'address' }],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };
    data.domain = { owner: '0x1111111111111111111111111111111111111111' };
    data.message = { owner: data.domain.owner, spender: data.domain.owner, value: '1', nonce: '0', deadline: '1' };
  });
  assert.deepEqual(listFor(text), [...ALWAYS, 'meaning-of-fields', 'contract-not-established']);
});

test('a contract that could not be verified is said so, and its fields are not explained', () => {
  const expected = [...ALWAYS, 'meaning-of-fields', 'contract-not-established'];
  // Compared with a list and not found on it: the list is not complete.
  assert.deepEqual(listFor(changed(permitSingle, (data) => (data.domain.name = 'Other'))), [
    ...expected,
    'published-lists-incomplete',
  ]);
  // Nothing to compare: the request declares no domain type.
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
  assert.deepEqual(listFor(bare), [...ALWAYS, ...PERMIT2, 'bare-large-numbers']);
  // The bare chain id in the EIP-712 example is small enough to be exact.
  assert.ok(!listFor(mail).includes('bare-large-numbers'));
});
