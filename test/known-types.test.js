import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequest } from '../src/parse.js';
import { recognise } from '../src/known-types.js';
import * as published from './fixtures/published-types.js';

const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

// A Permit2 request put together by the project owner; it is not a capture
// of a request some wallet showed. The types are the ones Uniswap's SDK sends
// (permit2PermitSingle in fixtures/published-types.js) and the contract
// address is the one that SDK publishes. The values follow the code in
// Uniswap's integration guide, which sets the allowance to expire in 30 days
// and the signature in 30 minutes, but the guide does not print these values:
// https://blog.uniswap.org/permit2-integration-guide (read 2026-10-04).
const permitSingle = read('permit2-permit-single.json');

// Contract addresses as the protocols' libraries publish them; sources are
// next to the same addresses in src/known-types.js.
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const PERMIT2_ON_324 = '0x0000000000225e31D15943971F47aD3022F714Fa';
const SEAPORT_1_6 = '0x0000000000000068F116a894984e2DB1123eB395';
const SEAPORT_1_5 = '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';
const UNPUBLISHED = '0x1111111111111111111111111111111111111111';

const PUBLISHED = [
  ['erc2612-permit', 'Permit', published.erc2612, UNPUBLISHED],
  ['dai-permit', 'Permit', published.dai, UNPUBLISHED],
  ['permit2-permit-single', 'PermitSingle', published.permit2PermitSingle, PERMIT2],
  ['permit2-permit-batch', 'PermitBatch', published.permit2PermitBatch, PERMIT2_ON_324],
  ['permit2-permit-transfer-from', 'PermitTransferFrom', published.permit2PermitTransferFrom, PERMIT2],
  ['seaport-order', 'OrderComponents', published.seaportOrder, SEAPORT_1_6],
  ['seaport-order', 'OrderComponents', published.seaportOrder, SEAPORT_1_5],
];

// The sources publish these types without a request around them, so the
// request here has an empty message and a domain with nothing but the
// contract address.
function recogniseTypes(primaryType, types, verifyingContract) {
  const domain = verifyingContract ? { verifyingContract } : {};
  return recognise(parseRequest(JSON.stringify({ types, primaryType, domain, message: {} })));
}

// Whether the declared types have a member at the end of a role's path.
function declares(types, primaryType, path) {
  let type = primaryType;
  for (const segment of path.split('.').slice(1)) {
    const member = types[type].find(({ name }) => name === segment.replace('[]', ''));
    if (!member || member.type.endsWith('[]') !== segment.endsWith('[]')) return false;
    type = member.type.replace('[]', '');
  }
  return true;
}

function valueAt(parsed, path) {
  const [root, ...names] = path.split('.');
  let field = { fields: parsed[root] };
  for (const name of names) field = field.fields.find((candidate) => candidate.name === name);
  return field.value;
}

// What this loop can and cannot show: that the declaration is recognised and
// that every role points at a member the type really has. Whether `amount`
// is the right name for that member is not something a test can know; that
// rests on the sources quoted in src/known-types.js.
for (const [kind, primaryType, types, contract] of PUBLISHED) {
  test(`recognises ${kind} at ${contract}`, () => {
    const known = recogniseTypes(primaryType, types, contract);
    assert.equal(known.kind, kind);
    for (const [role, path] of Object.entries(known.roles)) {
      if (path.startsWith('message.')) {
        assert.ok(declares(types, primaryType, path), `${role}: ${path}`);
      }
    }
  });
}

test('finds each role in a Permit2 request', () => {
  const parsed = parseRequest(permitSingle);
  const { kind, roles } = recognise(parsed);
  assert.equal(kind, 'permit2-permit-single');
  assert.equal(valueAt(parsed, roles.spender), '0x23617e59a5925b2a4bf75d73ff6711cd0b29de85');
  assert.equal(valueAt(parsed, roles.token), '0xdac17f958d2ee523a2206206994597c13d831ec7');
  assert.equal(valueAt(parsed, roles.amount), '1461501637330902918203684832716283019655932542975');
  assert.equal(valueAt(parsed, roles.allowanceExpiration), '1792662210');
  assert.equal(valueAt(parsed, roles.signatureDeadline), '1790072010');
});

test('gives no roles when the listed address is not part of what is signed', () => {
  const { permit2PermitSingle: types } = published;
  const withDomain = (EIP712Domain) =>
    recogniseTypes('PermitSingle', { ...types, EIP712Domain }, PERMIT2);
  const expected = { kind: 'permit2-permit-single', unlistedContract: true };
  // The address is a key in the domain object that the domain type leaves out.
  assert.deepEqual(withDomain([]), expected);
  // Declared, but not as an address: a different domain, a different hash.
  assert.deepEqual(withDomain([{ name: 'verifyingContract', type: 'string' }]), expected);
  // Declared as an address: the published case.
  assert.ok(withDomain([{ name: 'verifyingContract', type: 'address' }]).roles);
});

test('names the shape but gives no roles when the contract is not a published one', () => {
  for (const [kind, primaryType, types] of PUBLISHED.slice(2)) {
    const expected = { kind, unlistedContract: true };
    assert.deepEqual(recogniseTypes(primaryType, types, UNPUBLISHED), expected);
    assert.deepEqual(recogniseTypes(primaryType, types), expected);
  }
  const elsewhere = permitSingle.replace(PERMIT2.toLowerCase(), UNPUBLISHED);
  assert.notEqual(elsewhere, permitSingle);
  assert.deepEqual(recognise(parseRequest(elsewhere)), {
    kind: 'permit2-permit-single',
    unlistedContract: true,
  });
});

test('reads the domain of a Permit2 request: no version, chain id as a string', () => {
  assert.deepEqual(parseRequest(permitSingle).domain, [
    { name: 'chainId', value: '1' },
    { name: 'name', value: 'Permit2' },
    { name: 'verifyingContract', value: '0x000000000022d473030f116ddee9f6b43ac78ba3' },
  ]);
});

test('does not recognise the example from EIP-712', () => {
  assert.equal(recognise(parseRequest(read('eip712-example.json'))), null);
});

test('does not recognise three members written to look like five', () => {
  const [owner, spender, value, nonce, deadline] = published.erc2612.Permit;
  const merged = `${owner.name},${spender.type} ${spender.name},${value.type} ${value.name}`;
  const types = { Permit: [{ name: merged, type: owner.type }, nonce, deadline] };
  assert.equal(recogniseTypes('Permit', types), null);
});

test('does not recognise a type that shares only its name with a known one', () => {
  const types = structuredClone(published.erc2612);
  types.Permit[2].name = 'amount';
  assert.equal(recogniseTypes('Permit', types), null);
});
