import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { respond } from '../src/explain.js';
import { EIP_155 } from '../src/networks.js';
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

// Every line of an answer, flattened, in the order the page shows it.
function entryLines(entry) {
  if (typeof entry === 'string') return [entry];
  if (entry.heading) return [entry.heading];
  if (entry.link) return [entry.link.text];
  return [entry.label, ...(entry.value === undefined ? [] : [entry.value]), ...(entry.notes ?? []), ...(entry.sub ?? []).flatMap(entryLines)];
}
function lines(answer) {
  if (answer.refused) return answer.refused;
  return [answer.main, ...framed(answer), ...[...answer.details, ...answer.mechanics].flatMap(entryLines), ...answer.notChecked];
}
// What stands in the frames under the main sentence: each fact and its note.
const framed = (answer) => answer.notable.flatMap(({ text, note }) => (note ? [text, note] : [text]));
const facts = (answer) => answer.notable.map(({ text }) => text);
const labelled = (entries, label) => entries.find((entry) => entry.label === label);

test('every answer is complete: no blank left unfilled, nothing missing, in both languages', () => {
  for (const [language, texts] of [['en', en], ['ru', ru]]) {
    for (const [name, text] of Object.entries(REQUESTS)) {
      const answer = respond(text, texts, options(language));
      assert.equal(typeof answer.main, 'string', `${language} ${name}: main`);
      assert.ok(answer.details.length > 0, `${language} ${name}: details`);
      assert.ok(answer.notChecked.length >= 4, `${language} ${name}: not checked`);
      for (const line of lines(answer)) {
        assert.equal(typeof line, 'string', `${language} ${name}`);
        assert.doesNotMatch(line, /\{\w+\}|undefined|\bnull\b|NaN|\[object/, `${language} ${name}: ${line}`);
      }
    }
  }
});

test('the main sentence is short and holds no address and no number from the request', () => {
  for (const [language, texts] of [['en', en], ['ru', ru]]) {
    for (const [name, text] of Object.entries(REQUESTS)) {
      const { main } = respond(text, texts, options(language));
      assert.ok(main.length <= 170, `${language} ${name}: ${main.length}`);
      assert.doesNotMatch(main, /0x|\d{5}/, `${language} ${name}`);
    }
  }
});

test('no sentence has an address inside it: an address stands alone under its label', () => {
  const sentences = (entries) =>
    entries.flatMap((entry) =>
      typeof entry === 'string'
        ? [entry]
        : entry.heading
          ? [entry.heading]
          : entry.link
            ? [entry.link.text]
            : [entry.label, ...(entry.notes ?? []), ...sentences(entry.sub ?? [])],
    );
  for (const [name, text] of Object.entries(REQUESTS)) {
    const answer = respond(text, en, options('en'));
    for (const sentence of [answer.main, ...framed(answer), ...sentences([...answer.details, ...answer.mechanics])]) {
      assert.doesNotMatch(sentence, /0x[0-9a-fA-F]{40}/, `${name}: ${sentence}`);
    }
  }
});

test('an amount with no limit is in the main sentence, and said again next to the number', () => {
  const single = respond(permitSingle, en, options('en'));
  assert.equal(single.main, en.main.allowanceUnlimited);
  assert.deepEqual(labelled(single.details, en.amount.exact).notes.slice(0, 1), [en.permit2.unlimited]);
  // In a batch the main sentence says there is one, and the token itself is marked.
  const batched = respond(batch, en, options('en'));
  assert.equal(batched.main, en.main.batchUnlimited);
  const marked = batched.details.filter((entry) => Array.isArray(entry.sub) && entry.sub.some((sub) => sub.notes?.includes(en.permit2.unlimited)));
  assert.deepEqual(marked.map((entry) => [entry.label, entry.value]), [['Token 2, by the address of its contract', B]]);
  assert.ok(respond(dai(true), en, options('en')).main.includes('no limit on the amount'));
  // Where the source says nothing about the largest amount, only arithmetic
  // is said: straight under the main sentence, and next to the number.
  const largest = (2n ** 256n - 1n).toString();
  const standard = respond(erc2612(largest), en, options('en'));
  assert.equal(standard.main, en.main.erc2612);
  assert.deepEqual(standard.notable, [{ text: en.amount.largestNotable, note: en.amount.largestUnexplained }]);
  assert.deepEqual(labelled(standard.details, en.amount.exact).notes.slice(0, 1), [en.amount.largest]);
  assert.ok(framed(respond(transfer, en, options('en'))).includes(en.amount.largestUnexplained));
  assert.deepEqual(respond(erc2612('1000000'), en, options('en')).notable, []);
});

test('a deadline that has passed is said straight under the main sentence, and next to the date', () => {
  const answer = respond(batch, en, options('en'));
  // With it, what the protocol's own source says a passed deadline means.
  assert.deepEqual(answer.notable, [{ text: en.time.signatureDeadlinePassed, note: en.permit2.rejectsLate }]);
  const deadline = labelled(answer.details, en.time.signatureDeadline);
  assert.ok(deadline.value.endsWith('(10 minutes ago)'));
  assert.deepEqual(deadline.notes, [en.time.passed]);
  // The owner's request: its signature deadline is a fixed date, here set in the past.
  const later = respond(permitSingle, en, { ...options('en'), now: 1790072010 + 5 });
  assert.deepEqual(facts(later), [en.time.signatureDeadlinePassed]);
  // Once both of its times are behind, both are said, the signature's first.
  const muchLater = respond(permitSingle, ru, { ...options('ru'), now: 1792662210 + 5 });
  assert.deepEqual(muchLater.notable, [
    { text: ru.time.signatureDeadlinePassed, note: ru.permit2.rejectsLate },
    { text: ru.permit2.expirationPassed },
  ]);
  // In a batch a passed expiration stays next to its token.
  assert.deepEqual(facts(respond(batch, en, { ...options('en'), now: NOW + 86400 * 500 })), [en.time.signatureDeadlinePassed]);
  // The test order has an item chosen by a criterion of zero: that is said at the top too.
  assert.deepEqual(facts(respond(seaport, en, { ...options('en'), now: NOW + 86400 * 2 })), [en.seaport.anyItemNotable, en.seaport.endPassed]);
  assert.deepEqual(respond(erc2612('1'), en, { ...options('en'), now: NOW + 7200 }).notable, [
    { text: en.time.signatureDeadlinePassed, note: en.erc2612.rejectsLate },
  ]);
  assert.deepEqual(framed(respond(transfer.replace(/"deadline":"\d+"/, '"deadline":"5"'), en, options('en'))).slice(-2), [
    en.time.signatureDeadlinePassed,
    en.permit2.rejectsLate,
  ]);
  // A deadline of zero has passed; a DAI expiry of zero means no deadline, and is not said to have passed.
  assert.deepEqual(respond(dai(true, '5'), en, options('en')).notable, [
    { text: en.time.signatureDeadlinePassed, note: en.dai.rejectsLate },
  ]);
  // It is said at the top as what it is, no deadline, by the contract's own source.
  assert.deepEqual(respond(dai(true, '0'), en, options('en')).notable, [{ text: en.dai.expiryZeroNotable }]);
  assert.deepEqual(respond(seaport, en, options('en')).notable, [{ text: en.seaport.anyItemNotable }]);
});

test('the exact amount stands right under its label, with everything said about it', () => {
  const amount = labelled(respond(erc2612('1000000'), en, options('en')).details, en.amount.exact);
  assert.equal(amount.value, '1000000');
  assert.equal(amount.notes[0], en.amount.decimalsUnknown);
  // The page puts the field for decimals under an amount marked this way.
  assert.equal(amount.decimals, true);
});

test('an amount that is not converted says that decimals change nothing, and asks for none', () => {
  const unlimited = labelled(respond(permitSingle, en, options('en', 6)).details, en.amount.exact);
  assert.deepEqual(unlimited.notes, [en.permit2.unlimited, en.permit2.unlimitedDecimals]);
  assert.equal(unlimited.decimals, undefined);
  const largest = labelled(respond(erc2612((2n ** 256n - 1n).toString()), en, options('en')).details, en.amount.exact);
  assert.deepEqual(largest.notes, [en.amount.largest, en.amount.largestDecimals]);
});

test('with more than one token, a number of decimals the person enters is not used', () => {
  // The batch has two tokens. One number cannot describe both.
  const several = respond(batch, en, options('en', 6));
  const all = lines(several);
  assert.ok(several.details.includes(en.amount.severalTokens));
  assert.ok(!all.some((line) => line.includes('you entered')));
  // The marked guesses are still shown for the amount that is converted.
  assert.ok(all.includes('If the token has 6 decimals: 1. That is an assumption, not a fact.'));
  // No amount asks for decimals, so the page shows no field for them.
  const marked = (answer, mark) => answer.details.flatMap((entry) => (Array.isArray(entry.sub) ? entry.sub : [])).filter((sub) => sub[mark]);
  assert.equal(marked(several, 'decimals').length, 0);
  assert.equal(marked(several, 'converted').length, 1);

  // The same token listed twice is one token, whatever the case of its letters.
  const lower = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const twice = JSON.parse(batch);
  twice.message.details = [
    { token: lower, amount: '1000000', expiration: '0', nonce: '0' },
    { token: lower.toUpperCase().replace('0X', '0x'), amount: '2000000', expiration: '0', nonce: '1' },
  ];
  const one = respond(JSON.stringify(twice), en, options('en', 6));
  assert.ok(!one.details.includes(en.amount.severalTokens));
  assert.equal(lines(one).filter((line) => line.startsWith('With the number of decimals you entered (6)')).length, 2);
  assert.equal(marked(one, 'decimals').length, 2);

  // A Seaport order with two different ERC-20 tokens, and with one.
  const order = JSON.parse(seaport);
  assert.ok(!respond(seaport, en, options('en', 6)).details.includes(en.amount.severalTokens));
  order.message.offer = [{ ...item('1', '5'), token: B }];
  const two = respond(JSON.stringify(order), en, options('en', 6));
  assert.equal(two.details[0], en.amount.severalTokens);
  assert.ok(!lines(two).some((line) => line.includes('you entered')));
});

test('the list of what was not checked speaks only of what the answer has', () => {
  const list = (text, now = NOW) => respond(text, en, { ...options('en'), now }).notChecked;
  const decimals = en.notChecked['token-decimals'];
  const clock = en.notChecked['device-clock'];
  // Nothing is converted when the one amount is the largest its field holds.
  assert.ok(!list(permitSingle).includes(decimals));
  assert.ok(list(erc2612('1000000')).includes(decimals));
  assert.ok(list(batch).includes(decimals));
  // A DAI permit with no deadline shows no distance in time.
  assert.ok(!list(dai(true, '0')).includes(clock));
  assert.ok(list(dai(true, String(NOW + 60))).includes(clock));
  // The EIP-712 example has no token, and its answer has no line about one.
  assert.ok(!list(mail).includes(en.notChecked['token-genuine']));
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
  const answer = (allowed) => respond(dai(allowed), en, options('en'));
  const written = (allowed) => labelled(answer(allowed).details, en.dai.answerLabel);
  assert.equal(answer(true).main, en.main.daiYes);
  assert.equal(written(true).value, 'yes');
  assert.equal(answer(false).main, en.main.daiNo);
  assert.equal(written(false).value, 'no');
  for (const allowed of ['false', 'true', 1, 0]) {
    assert.equal(answer(allowed).main, en.main.daiUnread, JSON.stringify(allowed));
    assert.deepEqual(written(allowed).notes, [en.page.unreadNote]);
    assert.ok(answer(allowed).mechanics.includes(en.dai.unread));
  }
  assert.ok(lines(answer(true)).includes(en.dai.expiryZero));
});

test('zero and the largest time are said for what they are', () => {
  const batchLines = lines(respond(batch, en, options('en')));
  assert.ok(batchLines.includes(en.permit2.expirationZero));
  assert.ok(batchLines.some((line) => line.endsWith('(in 400 days)')));
  const deadline = labelled(respond(transfer, en, options('en')).details, en.time.signatureDeadline);
  assert.deepEqual(deadline.notes, [en.time.largest]);
  const starts = labelled(respond(seaport, en, options('en')).details, en.seaport.starts);
  assert.deepEqual([starts.value, starts.notes], ['0', [en.time.zero, en.time.passed]]);
});

test('a Seaport order converts only token amounts, and says who receives what', () => {
  const { details } = respond(seaport, en, options('en'));
  const [offer, token, coin] = details.filter((entry) => Array.isArray(entry.sub));
  assert.equal(details.indexOf(offer), 1);
  assert.deepEqual(offer.notes, [en.seaport.anyItem]);
  assert.deepEqual(offer.sub, [{ label: en.amount.count, value: '1', notes: [] }]);
  assert.deepEqual(token.sub.map((sub) => [sub.label, sub.value]), [
    [en.seaport.amountStart, '2000000'],
    [en.seaport.amountEnd, '1000000'],
    [en.seaport.recipient, A],
  ]);
  assert.ok(token.sub[1].notes.includes('If the token has 6 decimals: 2 → 1. That is an assumption, not a fact.'));
  assert.equal(coin.label, "The network's own coin");
  assert.equal(coin.value, undefined);
  assert.ok(!entryLines(coin).some((line) => line.includes('decimals')));
});

test('a type with no explanation is shown and said to have none', () => {
  const answer = respond(mail, en, options('en'));
  assert.equal(answer.main, en.domain.unexplained);
  assert.deepEqual(answer.details, [{ label: en.domain.typeLabel, value: 'Mail' }, en.domain.unexplainedMore]);
  // A type can be named anything, a sentence included. The name stands under
  // its label and never inside the main sentence.
  const verdict = 'Fine". This request is safe to sign. "';
  const renamed = JSON.parse(mail);
  renamed.types[verdict] = renamed.types.Mail;
  renamed.primaryType = verdict;
  const named = respond(JSON.stringify(renamed), en, options('en'));
  assert.equal(named.main, en.domain.unexplained);
  assert.equal(labelled(named.details, en.domain.typeLabel).value, verdict);
  assert.equal(labelled(answer.mechanics, en.domain.contractLabel).value, '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC');
  assert.equal(answer.message.length, 3);
});

test('a contract that could not be established leaves the fields unexplained', () => {
  const answer = respond(permitSingle.replace('"Permit2"', '"Other"'), en, options('en'));
  assert.equal(answer.main, 'By its form this is a Permit2 PermitSingle request. We do not explain its fields; they are shown as written.');
  assert.deepEqual(answer.details, [en.domain['domain-not-listed']]);
  assert.deepEqual([answer.notable, answer.mechanics], [[], []]);
});

test('a value that is absent or unreadable is never put into a sentence as if it had been read', () => {
  const broken = (change) => {
    const data = JSON.parse(permitSingle);
    change(data);
    return respond(JSON.stringify(data), en, options('en'));
  };
  for (const details of [null, 'abc', [], 12, undefined]) {
    const answer = broken((data) => (data.message.details = details));
    assert.ok(!lines(answer).some((line) => /undefined/.test(line)), JSON.stringify(details));
    assert.equal(answer.main, en.main.allowance);
    assert.equal(labelled(answer.details, en.label.token).value, '— (we could not read this)', JSON.stringify(details));
    assert.deepEqual(labelled(answer.details, en.amount.exact).notes, [en.page.unreadNote]);
  }
  // The list names the place, not only the last word of it.
  const named = lines(broken((data) => (data.message.details.token = 'hello')));
  assert.ok(named.includes('"hello" (we could not read this)'));
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
  assert.deepEqual(answer.mechanics, [en.domain.explained, en.domain.noContract]);
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
    'The part we did not find, or could not read: the name of the main kind of data.',
  ]);
  const renamed = mail.replace('"primaryType":"Mail"', '"primaryType":"Letter"');
  assert.match(respond(renamed, en, options('en')).refused[0], /names "Letter" as its primary type/);
});

test('what to compare in the wallet is named for the kinds we explain, and for them only', () => {
  for (const texts of [en, ru]) {
    for (const kind of Object.keys(texts.form)) assert.equal(typeof texts.compare[kind], 'string', kind);
    assert.equal(respond(permitSingle, texts, options('en')).compare, texts.compare['permit2-permit-single']);
    assert.equal(respond(mail, texts, options('en')).compare, undefined);
  }
});

// What a person must not miss in a Seaport order stands at the top of the answer,
// not only as a line inside an item: an amount that is the largest its field can
// hold, a criterion of zero (any item of the collection), an end time that is the
// largest number, and in DAI an expiry of zero (no deadline).
test('the things the concept names as the costly ones are said at the top, for Seaport and DAI as for the rest', () => {
  const LARGEST = (2n ** 256n - 1n).toString();
  const withMessage = (change) => {
    const order = JSON.parse(seaport);
    change(order.message);
    return JSON.stringify(order);
  };
  for (const [language, texts] of [['en', en], ['ru', ru]]) {
    const opts = options(language);
    // A criterion of zero.
    assert.deepEqual(facts(respond(seaport, texts, opts)), [texts.seaport.anyItemNotable]);
    // The same fact for two such items is said once.
    const two = respond(withMessage((m) => (m.offer = [item('4', '1'), item('5', '1')])), texts, opts);
    assert.deepEqual(facts(two), [texts.seaport.anyItemNotable]);

    // An amount that is the largest its field holds: an ERC-20 item ranging up to it,
    // and a single amount of an item of a collection.
    const range = respond(withMessage((m) => (m.consideration = [{ ...item('1', '5', LARGEST), recipient: A }])), texts, opts);
    assert.ok(range.notable.some((fact) => fact.text === texts.amount.largestNotable && fact.note === texts.amount.largestUnexplained));
    const single = respond(withMessage((m) => (m.consideration = [{ ...item('2', LARGEST), recipient: A }])), texts, opts);
    assert.ok(single.notable.some((fact) => fact.text === texts.amount.largestNotable && fact.note === undefined));

    // The line that converts a range with a side that is not converted has no
    // sentence in place of the number, and so no double full stop.
    const converted = lines(range).filter((line) => line.includes('→'));
    assert.ok(converted.length > 0);
    for (const line of converted) {
      assert.ok(line.includes(texts.amount.largestInline), line);
      assert.ok(!line.includes('..'), line);
    }

    // An end time that is the largest number.
    const endless = respond(withMessage((m) => (m.endTime = LARGEST)), texts, opts);
    assert.ok(facts(endless).includes(texts.seaport.endLargest));

    // DAI: an expiry of zero is no deadline, by the contract's own source.
    assert.deepEqual(facts(respond(dai(true), texts, opts)), [texts.dai.expiryZeroNotable]);
    assert.deepEqual(facts(respond(dai(true, String(NOW + 3600)), texts, opts)), []);
  }
});

test('a network is named only from the list in EIP-155, and the name comes with a link to that list at a fixed commit', () => {
  assert.match(EIP_155, /^https:\/\/github\.com\/ethereum\/EIPs\/blob\/[0-9a-f]{40}\/EIPS\/eip-155\.md$/);
  // A string has a method called link, so a string is told apart first.
  const links = (answer) => answer.mechanics.filter((entry) => typeof entry === 'object' && entry.link);
  for (const texts of [en, ru]) {
    // Chain ID 1 is in the list: named, with the link.
    assert.deepEqual(links(respond(permitSingle, texts, options('en'))), [{ link: { text: texts.domain.networkSource, href: EIP_155 } }]);
    // Chain ID 137 is not: the number alone, and nothing to link to.
    const unnamed = respond(permitSingle.replace('"chainId": "1"', '"chainId": "137"'), texts, options('en'));
    assert.deepEqual(links(unnamed), []);
    assert.ok(lines(unnamed).includes(texts.domain.network.replace('{chainId}', '137')));
  }
});


test('the note that we do not know what a token does with the largest amount stays whichever item comes first', () => {
  const LARGEST = (2n ** 256n - 1n).toString();
  const recipient = (fields) => ({ ...fields, recipient: A });
  for (const order of [
    [item('3', LARGEST), item('1', LARGEST)],
    [item('1', LARGEST), item('3', LARGEST)],
  ]) {
    const message = JSON.parse(seaport);
    message.message.consideration = order.map(recipient);
    for (const texts of [en, ru]) {
      const answer = respond(JSON.stringify(message), texts, options('en'));
      const said = answer.notable.filter((fact) => fact.text === texts.amount.largestNotable);
      assert.equal(said.length, 1);
      assert.equal(said[0].note, texts.amount.largestUnexplained);
    }
  }
});
