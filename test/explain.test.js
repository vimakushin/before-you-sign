import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { respond } from '../src/explain.js';
import en from '../src/texts/en.js';
import ru from '../src/texts/ru.js';
import * as published from './fixtures/published-types.js';

// The two requests used throughout the tests (the example from EIP-712 and
// the Permit2 request composed by the project owner), and requests composed
// here from the published type descriptions. The values in the composed ones
// are made up for the tests; none is a capture of a request a wallet showed.
const read = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const mail = read('eip712-example.json');
const permitSingle = read('permit2-permit-single.json');

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const NOW = 1790000000;
const DOMAIN_3 = [
  { name: 'name', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];
const DOMAIN_4 = [DOMAIN_3[0], { name: 'version', type: 'string' }, DOMAIN_3[1], DOMAIN_3[2]];
const PERMIT2 = { name: 'Permit2', chainId: '137', verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' };

const request = (primaryType, types, EIP712Domain, domain, message) =>
  JSON.stringify({ types: { ...types, EIP712Domain }, primaryType, domain, message });

const erc2612 = (value) =>
  request('Permit', { Permit: published.erc2612.Permit }, DOMAIN_4, { name: 'T', version: '1', chainId: '1', verifyingContract: A }, {
    owner: A,
    spender: B,
    value,
    nonce: '0',
    deadline: String(NOW + 3600),
  });
const dai = (allowed, expiry = '0') =>
  request(
    'Permit',
    published.dai,
    DOMAIN_4,
    { name: 'Dai Stablecoin', version: '1', chainId: '1', verifyingContract: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    { holder: A, spender: B, nonce: '0', expiry, allowed },
  );
const batch = request('PermitBatch', published.permit2PermitBatch, DOMAIN_3, PERMIT2, {
  details: [
    { token: A, amount: '1000000', expiration: '0', nonce: '0' },
    { token: B, amount: (2n ** 160n - 1n).toString(), expiration: String(NOW + 86400 * 400), nonce: '0' },
  ],
  spender: B,
  sigDeadline: String(NOW - 600),
});
const transfer = request('PermitTransferFrom', published.permit2PermitTransferFrom, DOMAIN_3, PERMIT2, {
  permitted: { token: A, amount: (2n ** 256n - 1n).toString() },
  spender: B,
  nonce: '5',
  deadline: (2n ** 256n - 1n).toString(),
});
const item = (itemType, startAmount, endAmount = startAmount) => ({ itemType, token: A, identifierOrCriteria: '0', startAmount, endAmount });
const seaport = request(
  'OrderComponents',
  published.seaportOrder,
  DOMAIN_4,
  { name: 'Seaport', version: '1.6', chainId: '1', verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395' },
  {
    offerer: A,
    zone: B,
    offer: [item('4', '1')],
    consideration: [{ ...item('1', '2000000', '1000000'), recipient: A }, { ...item('0', '5'), recipient: B }],
    orderType: '0',
    startTime: '0',
    endTime: String(NOW + 86400),
    zoneHash: '0x00',
    salt: '1',
    conduitKey: '0x00',
    counter: '0',
  },
);

const REQUESTS = { mail, permitSingle, erc2612: erc2612('1000000'), daiYes: dai(true), daiNo: dai(false), batch, transfer, seaport };
const options = (locale, decimals) => ({ now: NOW, locale, timeZone: 'UTC', decimals });

// Every line of an answer, flattened.
function lines(answer) {
  const body = (answer.body ?? []).flatMap((entry) => (typeof entry === 'string' ? [entry] : [entry.title, ...entry.lines]));
  return [...(answer.refused ?? []), ...(answer.headline ?? []), ...body, ...(answer.notChecked ?? [])];
}

test('every answer is complete: no blank left unfilled, nothing missing, in both languages', () => {
  for (const [language, texts] of [['en', en], ['ru', ru]]) {
    for (const [name, text] of Object.entries(REQUESTS)) {
      const answer = respond(text, texts, options(language));
      assert.ok(answer.headline.length > 0, `${language} ${name}: headline`);
      assert.ok(answer.notChecked.length >= 4, `${language} ${name}: not checked`);
      for (const line of lines(answer)) {
        assert.equal(typeof line, 'string', `${language} ${name}`);
        assert.doesNotMatch(line, /\{\w+\}|undefined|\bnull\b|NaN|\[object/, `${language} ${name}: ${line}`);
      }
    }
  }
});

test('an amount with no limit is in the headline, not down in a list', () => {
  const single = respond(permitSingle, en, options('en'));
  assert.equal(single.headline[1], en.permit2.unlimited);
  // In a batch the headline says there is one, and the entry itself is marked.
  const batched = respond(batch, en, options('en'));
  assert.ok(batched.headline.includes(en.permit2.unlimitedInBatch));
  const marked = batched.body.filter((entry) => entry.lines?.includes(en.amount.largest));
  assert.deepEqual(marked.map((entry) => entry.title), [`The token at ${B}:`]);
  assert.ok(respond(dai(true), en, options('en')).headline[1].includes('no limit on the amount'));
  // Where the source says nothing about the largest amount, only arithmetic is said.
  const largest = (2n ** 256n - 1n).toString();
  assert.deepEqual(respond(erc2612(largest), en, options('en')).headline.slice(1), [
    en.amount.largest,
    en.amount.largestUnexplained,
  ]);
  assert.ok(respond(transfer, en, options('en')).headline.includes(en.amount.largestUnexplained));
  assert.equal(respond(erc2612('1000000'), en, options('en')).headline.length, 1);
});

test('decimals are never guessed: two marked assumptions, or the one figure the person asked for', () => {
  const guessed = lines(respond(erc2612('1000000'), en, options('en')));
  assert.ok(guessed.includes('If the token has 18 decimals: 0.000000000001. That is an assumption, not a fact.'));
  assert.ok(guessed.includes('If the token has 6 decimals: 1. That is an assumption, not a fact.'));
  const stated = lines(respond(erc2612('1000000'), en, options('en', 6)));
  assert.ok(stated.some((line) => line.startsWith('With the number of decimals you entered (6): 1.')));
  assert.ok(!stated.some((line) => line.includes('assumption')));
});

test('a DAI permit says yes, says no, or says it could not read which', () => {
  const second = (allowed) => respond(dai(allowed), en, options('en')).headline[1];
  assert.match(second(true), /^The answer is yes/);
  assert.match(second(false), /^The answer is no/);
  for (const allowed of ['false', 'true', 1, 0]) {
    assert.match(second(allowed), /^We could not read the yes-or-no answer/, JSON.stringify(allowed));
  }
  assert.ok(lines(respond(dai(true), en, options('en'))).includes(en.dai.expiryZero));
});

test('zero and the largest time are said for what they are', () => {
  const batchLines = lines(respond(batch, en, options('en')));
  assert.ok(batchLines.includes(en.permit2.expirationZero));
  assert.ok(batchLines.some((line) => line.includes('(in 400 days)')));
  assert.ok(batchLines.some((line) => line.includes('(10 minutes ago)') && line.endsWith(en.time.passed)));
  const transferLines = lines(respond(transfer, en, options('en')));
  assert.ok(transferLines.some((line) => line.endsWith(en.time.largest)));
  const seaportLines = lines(respond(seaport, en, options('en')));
  assert.ok(seaportLines.includes(`Order starts: ${en.time.zero} ${en.time.passed}`));
});

test('a Seaport order converts only token amounts, and says who receives what', () => {
  const [offer, consideration] = respond(seaport, en, options('en')).body.filter((entry) => typeof entry !== 'string');
  assert.equal(offer.lines.length, 1);
  assert.ok(offer.lines[0].includes(en.seaport.anyItem));
  assert.ok(offer.lines[0].includes('Exact number in the request: 1'));
  assert.ok(!offer.lines[0].includes('decimals'));
  assert.ok(consideration.lines[0].includes('The amount changes over time: 2000000 when the order begins, 1000000 when it ends.'));
  assert.ok(consideration.lines[0].endsWith(`Received by the address ${A}.`));
  assert.ok(consideration.lines[1].startsWith("the network's own coin."));
  assert.ok(!consideration.lines[1].includes('decimals'));
});

test('a type with no explanation is shown and said to have none', () => {
  const answer = respond(mail, en, options('en'));
  assert.deepEqual(answer.headline, ['We have no explanation for the type "Mail". Below is what the request contains. We do not explain what its fields mean.']);
  assert.ok(answer.body.includes('The request is addressed to the contract at 0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC.'));
  assert.equal(answer.message.length, 3);
});

test('a contract that could not be established leaves the fields unexplained', () => {
  const answer = respond(permitSingle.replace('"Permit2"', '"Other"'), en, options('en'));
  assert.equal(answer.headline.length, 1);
  assert.match(answer.headline[0], /^By its form this is a Permit2 PermitSingle request, but its domain does not match/);
  assert.deepEqual(answer.body, []);
});

test('a value that is absent or unreadable is never put into a sentence as if it had been read', () => {
  const broken = (change) => {
    const data = JSON.parse(permitSingle);
    change(data);
    return lines(respond(JSON.stringify(data), en, options('en')));
  };
  for (const details of [null, 'abc', [], 12, undefined]) {
    const all = broken((data) => (data.message.details = details));
    assert.ok(!all.some((line) => /undefined/.test(line)), JSON.stringify(details));
    assert.ok(all[0].includes('(we could not read this)'), JSON.stringify(details));
  }
  // The list names the place, not only the last word of it.
  const named = broken((data) => (data.message.details.token = 'hello'));
  assert.ok(named.includes('We could not read some values: message.details.token. They are shown as written.'));
});

test('the name of a field proves nothing about what it holds', () => {
  const answer = respond(
    JSON.stringify({
      types: {
        EIP712Domain: [{ name: 'verifyingContract', type: 'string' }, { name: 'chainId', type: 'string' }],
        Note: [{ name: 'text', type: 'string' }],
      },
      primaryType: 'Note',
      domain: { verifyingContract: 'send all funds to bob', chainId: '1' },
      message: { text: 'hi' },
    }),
    en,
    options('en'),
  );
  assert.deepEqual(answer.body, [en.domain.explained, en.domain.noContract]);
});

test('a recovery phrase as copied from a numbered grid is not read, not echoed, and clears the box', () => {
  // Twelve ordinary words composed for this test; not a real recovery phrase.
  const words = ['apple', 'river', 'stone', 'candle', 'forest', 'window', 'silver', 'garden', 'bridge', 'yellow', 'market', 'planet'];
  const pasted = words.map((word, index) => `${index + 1}. ${word}`).join('\n');
  for (const texts of [en, ru]) {
    const answer = respond(pasted, texts, options('en'));
    assert.equal(answer.clear, true);
    assert.deepEqual(answer.refused, [texts.refusal['possible-secret-words']]);
    for (const word of words) assert.ok(!answer.refused[0].includes(word));
  }
  assert.equal(respond('not json at all', en, options('en')).clear, false);
});

test('refusals say what was seen', () => {
  assert.deepEqual(respond(mail.slice(0, 200), en, options('en')).refused, [en.refusal.truncated]);
  assert.deepEqual(respond('{"types":{}}', en, options('en')).refused, [
    en.refusal['unexpected-shape'],
    'The part we did not find, or could not read: "primaryType".',
  ]);
  const renamed = mail.replace('"primaryType":"Mail"', '"primaryType":"Letter"');
  assert.match(respond(renamed, en, options('en')).refused[0], /names "Letter" as its primary type/);
});
