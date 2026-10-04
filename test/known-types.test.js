import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequest } from '../src/parse.js';
import { recognise } from '../src/known-types.js';
import * as published from './fixtures/published-types.js';

const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

// A Permit2 request put together by the project owner; it is not a capture
// of a request some wallet showed. The message types are the ones Uniswap's
// SDK sends (permit2PermitSingle in fixtures/published-types.js), the domain
// type is the one the Permit2 contract hashes, and the contract address is
// the one the SDK publishes. The values follow the code in Uniswap's
// integration guide, which sets the allowance to expire in 30 days and the
// signature in 30 minutes, but the guide does not print these values:
// https://blog.uniswap.org/permit2-integration-guide (read 2026-10-04).
const permitSingle = read('permit2-permit-single.json');

// Domain types. The contracts publish them only as the strings they hash
// (quoted with their sources in src/known-types.js); these lists are those
// strings split into members by hand.
const NAME = { name: 'name', type: 'string' };
const VERSION = { name: 'version', type: 'string' };
const CHAIN = { name: 'chainId', type: 'uint256' };
const CONTRACT = { name: 'verifyingContract', type: 'address' };
const PERMIT2_DOMAIN = [NAME, CHAIN, CONTRACT];
const FULL_DOMAIN = [NAME, VERSION, CHAIN, CONTRACT];

const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const PERMIT2_ON_324 = '0x0000000000225e31D15943971F47aD3022F714Fa';
const SEAPORT_1_6 = '0x0000000000000068F116a894984e2DB1123eB395';
const SEAPORT_1_5 = '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';
const UNPUBLISHED = '0x1111111111111111111111111111111111111111';

// Domain values, composed here from the same published names, versions and
// addresses the code holds; they are not taken from a request a wallet showed.
const permit2 = (verifyingContract) => ({ name: 'Permit2', chainId: 1, verifyingContract });
const seaport = (version, verifyingContract) => ({ name: 'Seaport', version, chainId: 1, verifyingContract });
const dai = {
  name: 'Dai Stablecoin',
  version: '1',
  chainId: 1,
  verifyingContract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
};

// kind, main type, message types, domain type, domain values
const LISTED = [
  ['dai-permit', 'Permit', published.dai, FULL_DOMAIN, dai],
  ['permit2-permit-single', 'PermitSingle', published.permit2PermitSingle, PERMIT2_DOMAIN, permit2(PERMIT2)],
  ['permit2-permit-batch', 'PermitBatch', published.permit2PermitBatch, PERMIT2_DOMAIN, permit2(PERMIT2_ON_324)],
  [
    'permit2-permit-transfer-from',
    'PermitTransferFrom',
    published.permit2PermitTransferFrom,
    PERMIT2_DOMAIN,
    permit2(PERMIT2),
  ],
  ['seaport-order', 'OrderComponents', published.seaportOrder, FULL_DOMAIN, seaport('1.6', SEAPORT_1_6)],
  ['seaport-order', 'OrderComponents', published.seaportOrder, FULL_DOMAIN, seaport('1.5', SEAPORT_1_5)],
];

// The sources publish these types without a request around them, so the
// request here has an empty message.
function recogniseTypes(primaryType, types, domain = {}) {
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

// What these tests can and cannot show: that the declaration is recognised
// and that every role points at a member the type really has. Whether
// `amount` is the right name for that member is not something a test can
// know; that rests on the sources quoted in src/known-types.js.
function assertRolesDeclared(known, types, primaryType) {
  for (const [role, path] of Object.entries(known.roles)) {
    if (path.startsWith('message.')) assert.ok(declares(types, primaryType, path), `${role}: ${path}`);
  }
}

test('recognises an ERC-2612 permit whatever token it is addressed to', () => {
  for (const verifyingContract of [UNPUBLISHED, undefined]) {
    const known = recogniseTypes('Permit', published.erc2612, { verifyingContract });
    assert.equal(known.kind, 'erc2612-permit');
    assertRolesDeclared(known, published.erc2612, 'Permit');
  }
});

for (const [kind, primaryType, types, EIP712Domain, domain] of LISTED) {
  test(`recognises ${kind} with the domain published for ${domain.verifyingContract}`, () => {
    const known = recogniseTypes(primaryType, { ...types, EIP712Domain }, domain);
    assert.equal(known.kind, kind);
    assertRolesDeclared(known, types, primaryType);
  });

  test(`gives ${kind} at ${domain.verifyingContract} no roles once the domain differs`, () => {
    const withDomain = (domainType, values) =>
      recogniseTypes(primaryType, { ...types, EIP712Domain: domainType }, values);
    const notListed = { kind, unverified: 'domain-not-listed' };

    assert.deepEqual(withDomain(EIP712Domain, { ...domain, verifyingContract: UNPUBLISHED }), notListed);
    assert.deepEqual(withDomain(EIP712Domain, { ...domain, name: 'Other' }), notListed);
    // The published address as a key the domain type leaves out: not signed.
    assert.deepEqual(withDomain([NAME, CHAIN], domain), notListed);
    // Declared, but not as an address: a different domain, a different hash.
    const asString = EIP712Domain.map((member) => (member === CONTRACT ? { ...member, type: 'string' } : member));
    assert.deepEqual(withDomain(asString, domain), notListed);

    assert.deepEqual(recogniseTypes(primaryType, types, domain), { kind, unverified: 'domain-not-declared' });
  });
}

test('does not accept one Seaport version at the address of another', () => {
  const types = { ...published.seaportOrder, EIP712Domain: FULL_DOMAIN };
  assert.deepEqual(recogniseTypes('OrderComponents', types, seaport('1.6', SEAPORT_1_5)), {
    kind: 'seaport-order',
    unverified: 'domain-not-listed',
  });
});

test('does not name DAI on a network other than the one its address is published for', () => {
  const types = { ...published.dai, EIP712Domain: FULL_DOMAIN };
  assert.deepEqual(recogniseTypes('Permit', types, { ...dai, chainId: 137 }), {
    kind: 'dai-permit',
    unverified: 'domain-not-listed',
  });
});

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
