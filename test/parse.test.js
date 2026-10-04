import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequest } from '../src/parse.js';

// The request below is the example from the text of EIP-712 itself, section
// "Specification of the eth_signTypedData JSON RPC", copied byte for byte
// (retrieved 2026-10-04):
// https://github.com/ethereum/EIPs/blob/3b3c832577ec4205d463d990d52006e299962449/EIPS/eip-712.md
// Every other input in this file is that same request, damaged in one way.
const example = readFileSync(new URL('./fixtures/eip712-example.json', import.meta.url), 'utf8');

function damaged(change) {
  const data = JSON.parse(example);
  change(data);
  return JSON.stringify(data);
}

test('reads the example from the standard', () => {
  assert.deepEqual(parseRequest(example), {
    parsed: true,
    primaryType: 'Mail',
    types: JSON.parse(example).types,
    domain: [
      { name: 'name', type: 'string', value: 'Ether Mail' },
      { name: 'version', type: 'string', value: '1' },
      { name: 'chainId', type: 'uint256', value: '1', bare: true },
      {
        name: 'verifyingContract',
        type: 'address',
        value: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
      },
    ],
    message: [
      {
        name: 'from',
        type: 'Person',
        fields: [
          { name: 'name', type: 'string', value: 'Cow' },
          { name: 'wallet', type: 'address', value: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
        ],
      },
      {
        name: 'to',
        type: 'Person',
        fields: [
          { name: 'name', type: 'string', value: 'Bob' },
          { name: 'wallet', type: 'address', value: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
        ],
      },
      { name: 'contents', type: 'string', value: 'Hello, Bob!' },
    ],
  });
});

test('a bare number keeps every digit', () => {
  // 2^256 - 1 written as a JSON number, not a string. JSON.parse alone would
  // return 1.157920892373162e+77.
  const max = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
  const text = example.replace('"chainId":1', `"chainId":${max}`);
  assert.notEqual(text, example);
  const chainId = parseRequest(text).domain.find((field) => field.name === 'chainId');
  assert.equal(chainId.value, max);
});

test('marks a number written without quotes, and only that', () => {
  const bare = parseRequest(example).domain.find((field) => field.name === 'chainId');
  assert.equal(bare.bare, true);
  const quoted = parseRequest(example.replace('"chainId":1', '"chainId":"1"')).domain.find(
    (field) => field.name === 'chainId',
  );
  assert.deepEqual(quoted, { name: 'chainId', type: 'uint256', value: '1' });
});

test('digits inside a string are left alone', () => {
  const text = example.replace('Hello, Bob!', 'Send 100 to \\"Bob\\" 7');
  const contents = parseRequest(text).message.find((field) => field.name === 'contents');
  assert.equal(contents.value, 'Send 100 to "Bob" 7');
});

test('reads an array member item by item', () => {
  const text = damaged((data) => {
    data.types.Mail[1].type = 'Person[]';
    data.message.to = [data.message.to, data.message.from];
  });
  const to = parseRequest(text).message.find((field) => field.name === 'to');
  assert.equal(to.type, 'Person[]');
  assert.deepEqual(
    to.items.map((item) => item.fields[0].value),
    ['Bob', 'Cow'],
  );
});

test('reads a request whose types leave out the domain', () => {
  const text = damaged((data) => delete data.types.EIP712Domain);
  const { parsed, domain, message } = parseRequest(text);
  assert.equal(parsed, true);
  assert.deepEqual(domain, [
    { name: 'name', value: 'Ether Mail' },
    { name: 'version', value: '1' },
    { name: 'chainId', value: '1', bare: true },
    { name: 'verifyingContract', value: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' },
  ]);
  assert.equal(message.length, 3);
});

test('returns keys the type does not declare, flagged, after the declared ones', () => {
  const text = damaged((data) => {
    data.domain.salt = '0x01';
    data.message.to.amount = 5;
    data.message.cc = { name: 'Eve' };
  });
  const { domain, message } = parseRequest(text);
  assert.deepEqual(domain.at(-1), { name: 'salt', value: '0x01', undeclared: true });
  assert.deepEqual(message[1].fields.at(-1), { name: 'amount', value: '5', bare: true, undeclared: true });
  assert.deepEqual(message.at(-1), { name: 'cc', value: { name: 'Eve' }, undeclared: true });
  assert.equal(message.length, 4);
});

test('refuses empty input', () => {
  assert.deepEqual(parseRequest(''), { parsed: false, reason: 'empty' });
  assert.deepEqual(parseRequest('  \n '), { parsed: false, reason: 'empty' });
});

test('refuses text that is not JSON', () => {
  assert.deepEqual(parseRequest('Signature request'), { parsed: false, reason: 'not-json' });
});

test('refuses a request cut off at any point', () => {
  for (let length = 1; length < example.trimEnd().length; length++) {
    assert.deepEqual(parseRequest(example.slice(0, length)), { parsed: false, reason: 'truncated' });
  }
});

test('refuses two requests pasted together', () => {
  assert.deepEqual(parseRequest(example + example), { parsed: false, reason: 'trailing-text' });
});

test('does not name a fix that would not help', () => {
  // Brackets of different kinds do not close each other: nothing is missing here.
  const mispaired = example.trimEnd().slice(0, -1) + ']';
  assert.deepEqual(parseRequest(mispaired), { parsed: false, reason: 'not-json' });
  // Removing the second request would still leave a broken first one.
  const broken = example.replace('"chainId":1', '"chainId":tru');
  assert.deepEqual(parseRequest(broken + example), { parsed: false, reason: 'not-json' });
});

test('reads a request pasted with a non-breaking space or a byte order mark', () => {
  assert.equal(parseRequest(' ' + example).parsed, true);
  assert.equal(parseRequest('﻿' + example).parsed, true);
});

test('refuses a domain nested too deep to read', () => {
  const levels = 5000;
  const text = damaged((data) => {
    data.types.EIP712Domain = [{ name: 'inner', type: 'EIP712Domain[]' }];
    data.domain = 'DOMAIN';
  }).replace('"DOMAIN"', '{"inner":['.repeat(levels) + ']}'.repeat(levels));
  assert.deepEqual(parseRequest(text), { parsed: false, reason: 'too-deep' });
});

test('refuses a message nested too deep to read', () => {
  const levels = 5000;
  const text = damaged((data) => {
    data.types.Mail = [{ name: 'to', type: 'Mail[]' }];
    data.message = 'MESSAGE';
  }).replace('"MESSAGE"', '{"to":['.repeat(levels) + ']}'.repeat(levels));
  assert.deepEqual(parseRequest(text), { parsed: false, reason: 'too-deep' });
});

test('refuses JSON that is not a signing request', () => {
  assert.deepEqual(parseRequest('[1, 2]'), { parsed: false, reason: 'unexpected-shape' });
  for (const key of ['types', 'primaryType', 'domain', 'message']) {
    const text = damaged((data) => delete data[key]);
    assert.deepEqual(parseRequest(text), { parsed: false, reason: 'unexpected-shape', detail: key });
  }
  const text = damaged((data) => (data.types.Person = 'Person'));
  assert.deepEqual(parseRequest(text), { parsed: false, reason: 'unexpected-shape', detail: 'types' });
});

test('refuses a request whose main type is not declared', () => {
  const text = damaged((data) => (data.primaryType = 'Permit'));
  assert.deepEqual(parseRequest(text), { parsed: false, reason: 'main-type-not-found', detail: 'Permit' });
});

test('flags a value that does not fit its type and keeps the rest', () => {
  const text = damaged((data) => {
    data.message.from = 'Cow';
    delete data.message.contents;
  });
  const { parsed, message } = parseRequest(text);
  assert.equal(parsed, true);
  assert.deepEqual(message[0], { name: 'from', type: 'Person', value: 'Cow', unread: true });
  assert.equal(message[1].fields.length, 2);
  assert.deepEqual(message[2], { name: 'contents', type: 'string', value: undefined, unread: true });
});
