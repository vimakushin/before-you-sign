// Puts an answer together out of the pieces: the parser, the table of types,
// the readers of numbers, the list of what was not checked, and the texts.
// Text in, lines of text out; nothing here touches the page, so all of it can
// be tested without a browser.
//
// The answer is { refused, clear } when the text could not be read, and
// otherwise, in the order the page shows it:
//   main        one short sentence: what this signature gives. No address and
//               no number in it, so that it can be read at a glance;
//   notable     what must not be missed, straight under the main sentence: a
//               deadline that has already passed, an amount that is the
//               largest its field holds. Each is { text, note }: the fact,
//               and what the protocol's own source says follows from it;
//   details     who, which token, how much, until when;
//   mechanics   how the request works: its domain, and what a matching
//               domain does and does not tell;
//   notChecked  what this answer has not checked, never empty;
//   domain, message  the fields as parsed, for showing the request as written.
//
// `details` and `mechanics` are lists of entries. An entry is a sentence, or
// { heading }, or { label, value, notes, sub }: a value from the request on a
// line of its own, with a label saying what it is. An address is forty
// characters with no spaces, and nobody reads one in the middle of a
// sentence, so no sentence here has an address or an amount inside it.

import { parseRequest } from './parse.js';
import { recognise } from './known-types.js';
import { notChecked } from './unknowns.js';
import { readAmount, readCount, readTime, readInteger, isAddress, notRead, losesDigits } from './values.js';
import { networkName } from './networks.js';

// `texts` is one of the files in texts/; `now` is the current time in
// seconds; `decimals` is what the person entered, if anything; `locale` and
// `timeZone` say how to write a date.
export function respond(pasted, texts, { now, decimals, locale, timeZone }) {
  const parsed = parseRequest(pasted);
  if (!parsed.parsed) return refusal(parsed, texts);

  const known = recognise(parsed);
  const say = { t: texts, now, decimals, locale, timeZone };
  const answer = known?.roles ? explained(parsed, known, say) : shownOnly(parsed, known, say);
  const said = everyEntry(answer.details);
  return {
    ...answer,
    notChecked: notChecked(parsed, known)
      .filter((code) => SAID_ONLY_WITH[code]?.(said) ?? true)
      .map((code) => fill(texts.notChecked[code], blanksFor(code, parsed))),
    domain: parsed.domain,
    message: parsed.message,
  };
}

// Two lines of the "not checked" list speak of something the answer may not
// contain: a distance in time counted from the device's clock, and an amount
// that would need the token's decimals. They are listed only when the answer
// has what they speak of. A DAI permit with no deadline shows no "in 3 days";
// an amount that is the largest its field holds is not converted at all.
const SAID_ONLY_WITH = {
  'device-clock': (entries) => entries.some((entry) => entry.clock),
  'token-decimals': (entries) => entries.some((entry) => entry.converted) || !entries.some((entry) => entry.largest),
};

function everyEntry(entries) {
  // A sentence is an entry too, and a string has a method named "sub".
  return entries.flatMap((entry) => [entry, ...everyEntry(Array.isArray(entry.sub) ? entry.sub : [])]);
}

function refusal({ reason, detail }, t) {
  const lines = [fill(t.refusal[reason], { type: detail })];
  // The missing part is named in words: "types" is a word of the format.
  if (reason === 'unexpected-shape' && detail) lines.push(fill(t.refusal['unexpected-shape-part'], { part: t.part[detail] }));
  // The one refusal after which the page empties its input: see parse.js.
  return { refused: lines, clear: reason === 'possible-secret-words' };
}

// Fills the blanks of a text in one pass, so that a value from the request
// that itself looks like a blank is put in as it is and not filled again.
function fill(text, blanks = {}) {
  return text.replace(/\{(\w+)\}/g, (blank, name) => (name in blanks ? String(blanks[name]) : blank));
}

// What goes into the blanks of a line of the "not checked" list.
const NAMED_BY = {
  'undeclared-keys': (field) => field.undeclared,
  'unread-values': notRead,
  'bare-large-numbers': losesDigits,
};

function blanksFor(code, parsed) {
  const names = NAMED_BY[code]
    ? [...located(parsed.domain, 'domain'), ...located(parsed.message, 'message')]
        .filter(({ field }) => NAMED_BY[code](field))
        .map(({ path }) => path)
        .join(', ')
    : undefined;
  return { chainId: declared(parsed.domain, 'chainId')?.value, names };
}

// Every field at every depth with the path that leads to it, such as
// "message.details[1].token". An item of a list has no name of its own, and
// two members of different structs can share one; the path tells them apart.
function located(top, root) {
  const found = [];
  const pending = top.map((field) => ({ field, path: `${root}.${field.name}` }));
  while (pending.length > 0) {
    const { field, path } = pending.pop();
    found.push({ field, path });
    for (const child of field.fields ?? []) pending.push({ field: child, path: `${path}.${child.name}` });
    (field.items ?? []).forEach((item, index) => pending.push({ field: item, path: `${path}[${index}]` }));
  }
  return found.reverse();
}

// A declared member by name; a key the type does not declare is not it.
function declared(fields, name) {
  return fields.find((field) => field.name === name && !field.undeclared);
}

// A value exactly as the request has it, for the cases where we could not
// read it. Strings keep their quotes, so that "true" and true stay apart.
function asWritten(field) {
  return field?.value === undefined ? '—' : JSON.stringify(field.value);
}

// A value we expect to be readable, such as an address. One that is absent
// or that we could not read is never shown as if it had been read: it is
// shown as written, marked.
function shown(field, t) {
  if (field?.value !== undefined && !notRead(field)) return field.value;
  return `${asWritten(field)} (${t.page.flagUnread})`;
}

// ---------------------------------------------------------------- no roles

// A type we do not explain, or one whose contract could not be established:
// what can be said without the roles.
function shownOnly(parsed, known, say) {
  const { t } = say;
  if (known) {
    return { main: fill(t.domain.formOnly, { form: t.form[known.kind] }), notable: [], details: [t.domain[known.unverified]], mechanics: [] };
  }

  const mechanics = [];
  if (Object.hasOwn(parsed.types, 'EIP712Domain')) {
    // The name of a member proves nothing about what it holds: only a member
    // declared as an address and written as one is called the contract.
    const contract = declared(parsed.domain, 'verifyingContract');
    const readable = contract?.type === 'address' && !notRead(contract);
    mechanics.push(t.domain.explained);
    mechanics.push(readable ? { label: t.domain.contractLabel, value: contract.value } : t.domain.noContract);
    mechanics.push(...network(parsed, say));
  }
  // The name of the type is whatever the request says it is, a whole sentence
  // included. It goes under a label like any other value, never into the
  // largest line of the page.
  return {
    main: t.domain.unexplained,
    notable: [],
    details: [{ label: t.domain.typeLabel, value: parsed.primaryType }, t.domain.unexplainedMore],
    mechanics,
  };
}

function network(parsed, { t }) {
  const chain = declared(parsed.domain, 'chainId');
  if (chain?.type !== 'uint256' || notRead(chain)) return [];
  const name = networkName(chain.value);
  return [fill(name ? t.domain.networkNamed : t.domain.network, { chainId: chain.value, name })];
}

// ------------------------------------------------------------------- roles

// The number of decimals a person enters describes one token. A request can
// name several, each with its own number, and one number applied to all of
// them would give an amount that looks exact and is wrong, under the words
// "you entered". So with more than one token the entered number is not used
// at all, and the answer says why. Takes the fields that hold the tokens'
// addresses; one that could not be read counts as a token of its own.
function forTokens(say, tokens) {
  const distinct = new Set(tokens.map((field) => (isAddress(field.value) && !notRead(field) ? field.value.toLowerCase() : field)));
  return distinct.size > 1 ? { ...say, decimals: undefined, several: true } : say;
}

function explained(parsed, known, say) {
  const { t } = say;
  const { message, domain } = parsed;
  const member = (name, fields = message) => declared(fields, name) ?? {};
  const address = (label, field) => ({ label, value: shown(field, t) });
  const contract = declared(domain, 'verifyingContract')?.value;
  // A domain that matched has words of its own: what matched, and what that
  // does not mean. Saying nothing here would read as "all is well".
  const matched = (text, blanks) => [
    t.domain.explained,
    fill(text, blanks),
    { label: t.domain.contractLabel, value: contract },
    ...network(parsed, say),
  ];
  // The sentences about how the request works point at an address by the
  // label it stands under, not by its place in the list.
  const labels = { spender: t.label.spender, holder: t.label.holder };
  const notable = [];
  // A time that ends something. When it has passed, that is said at the top
  // as well as next to the date.
  const ending = (label, field, text, note) => {
    const read = timeEntry(label, field, say);
    if (read.passed) notable.push({ text, note });
    return read.entry;
  };
  // "The deadline has passed" alone leaves a person asking what that means.
  // What it means is in each source, and saying it is translation: the
  // contract rejects a signature submitted after its deadline (the quotes
  // are in known-types.js).
  const signatureDeadline = (field, rejectsLate) =>
    ending(t.time.signatureDeadline, field, t.time.signatureDeadlinePassed, rejectsLate);
  // Where the protocol's source says nothing about the largest amount, only
  // the arithmetic is said, and that we do not know what follows from it.
  const largestWithoutSource = (amount) => {
    if (amount.largest) notable.push({ text: t.amount.largestNotable, note: t.amount.largestUnexplained });
    return amount.entry;
  };

  switch (known.kind) {
    case 'erc2612-permit':
      return {
        main: t.main.erc2612,
        notable,
        details: [
          address(t.label.spender, member('spender')),
          address(t.label.holder, member('owner')),
          known.roles.token ? { label: t.erc2612.token, value: contract } : t.erc2612.tokenMissing,
          largestWithoutSource(amountEntry(member('value'), true, say)),
          signatureDeadline(member('deadline'), t.erc2612.rejectsLate),
        ],
        mechanics: [fill(t.erc2612.what, labels), ...network(parsed, say)],
      };
    case 'dai-permit': {
      const allowed = member('allowed');
      const readable = !allowed.unread && typeof allowed.value === 'boolean';
      const expiry = member('expiry');
      return {
        main: !readable ? t.main.daiUnread : allowed.value ? t.main.daiYes : t.main.daiNo,
        notable,
        details: [
          address(t.label.spender, member('spender')),
          address(t.label.holder, member('holder')),
          readable
            ? { label: t.dai.answerLabel, value: allowed.value ? t.dai.yesWord : t.dai.noWord }
            : { label: t.dai.answerLabel, value: asWritten(allowed), notes: [t.page.unreadNote] },
          readTime(expiry, say.now)?.zero
            ? { label: t.time.signatureDeadline, value: String(expiry.value), notes: [t.dai.expiryZero] }
            : signatureDeadline(expiry, t.dai.rejectsLate),
        ],
        mechanics: [t.dai.what, !readable ? t.dai.unread : fill(allowed.value ? t.dai.yes : t.dai.no, labels), ...matched(t.domain.dai)],
      };
    }
    case 'permit2-permit-single': {
      const details = member('details').fields ?? [];
      const amount = amountEntry(member('amount', details), true, say, true);
      return {
        main: amount.largest ? t.main.allowanceUnlimited : t.main.allowance,
        notable,
        details: [
          address(t.label.spender, member('spender')),
          address(t.label.token, member('token', details)),
          amount.entry,
          t.permit2.twoTimes,
          signatureDeadline(member('sigDeadline'), t.permit2.rejectsLate),
          expirationEntry(member('expiration', details), say, notable),
        ],
        mechanics: [fill(t.permit2.single, labels), t.permit2.owner, ...matched(t.domain.permit2)],
      };
    }
    case 'permit2-permit-batch': {
      // Each token says for itself whether its amount is the largest: with
      // several tokens, the main sentence alone would not say which one it is.
      const entries = (member('details').items ?? []).map((entry) => entry.fields ?? []);
      const each = forTokens(say, entries.map((details) => member('token', details)));
      const tokens = entries.map((details, index) => {
        const amount = amountEntry(member('amount', details), true, each, true);
        return {
          largest: amount.largest,
          entry: {
            ...address(fill(t.permit2.batchToken, { n: index + 1 }), member('token', details)),
            sub: [amount.entry, expirationEntry(member('expiration', details), say)],
          },
        };
      });
      return {
        main: tokens.some((token) => token.largest) ? t.main.batchUnlimited : t.main.batch,
        notable,
        details: [
          address(t.label.spender, member('spender')),
          ...(each.several ? [t.amount.severalTokens] : []),
          ...tokens.map((token) => token.entry),
          t.permit2.twoTimes,
          signatureDeadline(member('sigDeadline'), t.permit2.rejectsLate),
        ],
        mechanics: [fill(t.permit2.batch, labels), t.permit2.owner, ...matched(t.domain.permit2)],
      };
    }
    case 'permit2-permit-transfer-from': {
      const permitted = member('permitted').fields ?? [];
      const spender = { spender: t.label.transferSpender };
      return {
        main: t.main.transfer,
        notable,
        details: [
          address(t.label.transferSpender, member('spender')),
          fill(t.permit2.transferRecipient, spender),
          address(t.label.token, member('token', permitted)),
          largestWithoutSource(amountEntry(member('amount', permitted), true, say)),
          signatureDeadline(member('deadline'), t.permit2.rejectsLate),
        ],
        mechanics: [fill(t.permit2.transfer, spender), ...matched(t.domain.permit2)],
      };
    }
    case 'seaport-order': {
      const listed = (name) => (member(name).items ?? []).map((item) => item.fields ?? []);
      // Only an ERC-20 item (itemType 1) has an amount converted by decimals.
      const erc20 = [...listed('offer'), ...listed('consideration')].filter(
        (fields) => readInteger(declared(fields, 'itemType')?.value) === 1n,
      );
      const each = forTokens(say, erc20.map((fields) => declared(fields, 'token') ?? {}));
      const items = (name) => listed(name).map((fields) => itemEntry(fields, known, each));
      return {
        main: t.main.seaport,
        notable,
        details: [
          ...(each.several ? [t.amount.severalTokens] : []),
          { heading: t.seaport.offer },
          ...items('offer'),
          t.seaport.offerRecipient,
          { heading: t.seaport.consideration },
          ...items('consideration'),
          t.seaport.extended,
          timeEntry(t.seaport.starts, member('startTime'), say).entry,
          ending(t.seaport.ends, member('endTime'), t.seaport.endPassed),
        ],
        mechanics: matched(t.domain.seaport, { version: declared(domain, 'version')?.value }),
      };
    }
  }
}

// The expiration of a Permit2 allowance: zero has a meaning of its own there.
// `notable` is given only where the request has one allowance; in a batch the
// note stays next to its token.
function expirationEntry(field, say, notable) {
  const { t } = say;
  if (readTime(field, say.now)?.zero) return { label: t.permit2.expiration, value: String(field.value), notes: [t.permit2.expirationZero] };
  const read = timeEntry(t.permit2.expiration, field, say);
  if (read.passed && notable) notable.push({ text: t.permit2.expirationPassed });
  return read.entry;
}

// One item of a Seaport order: what it is, with its address, and under it
// the ID, the amount and who receives it.
function itemEntry(fields, known, say) {
  const { t } = say;
  const member = (name) => declared(fields, name) ?? {};
  const kind = known.itemKinds[Number(readInteger(member('itemType').value) ?? -1)];
  if (!kind) return { label: 'itemType', value: asWritten(member('itemType')), notes: [t.page.unreadNote] };

  const id = member('identifierOrCriteria');
  const entry = { label: t.seaport[kind], notes: [], sub: [] };
  if (kind !== 'native') entry.value = shown(member('token'), t);
  if (kind.endsWith('criteria') && readInteger(id.value) === 0n) entry.notes.push(t.seaport.anyItem);
  if (kind === 'erc721' || kind === 'erc1155') entry.sub.push({ label: t.seaport.tokenId, value: shown(id, t) });

  // Only an ERC-20 amount is converted by decimals: see known-types.js.
  const convert = kind === 'erc20';
  const read = (field) => (convert ? readAmount(field, say.decimals) : readCount(field));
  const start = member('startAmount');
  const end = member('endAmount');
  const [from, to] = [read(start), read(end)];
  if (from === null || to === null || from.exact === to.exact) {
    entry.sub.push(amountEntry(from === null ? start : end, convert, say).entry);
  } else {
    // Two amounts, and each is converted like any other: the number of
    // decimals the person entered, or the two marked guesses.
    const notes = [];
    const pair = (a, b) => `${a ?? t.amount.largest} → ${b ?? t.amount.largest}`;
    if (from.amount !== undefined || to.amount !== undefined) {
      notes.push(fill(t.amount.stated, { decimals: say.decimals, amount: pair(from.amount, to.amount) }));
    } else if (from.assumed || to.assumed) {
      notes.push(t.amount.decimalsUnknown);
      for (const [index, { decimals }] of (from.assumed ?? to.assumed).entries()) {
        notes.push(fill(t.amount.assumed, { decimals, amount: pair(from.assumed?.[index].amount, to.assumed?.[index].amount) }));
      }
    }
    entry.sub.push(
      { label: t.seaport.amountStart, value: String(from.exact) },
      { label: t.seaport.amountEnd, value: String(to.exact), notes, converted: convert, decimals: convert && !say.several },
    );
  }
  const recipient = declared(fields, 'recipient');
  if (recipient) entry.sub.push({ label: t.seaport.recipient, value: shown(recipient, t) });
  return entry;
}

// ------------------------------------------------------- amounts and times

// An amount: the exact number on its own line, and under it everything we
// say about that number, so that no statement about an amount is ever apart
// from the amount. `unlimited` is true where the protocol's source gives the
// largest amount a meaning of its own (Permit2's allowances).
//
// Three marks on the entry are for the page and for the "not checked" list:
// `converted`, when a conversion by decimals is shown; `decimals`, when the
// person can usefully say how many decimals the token has, which is the same
// thing unless the request has several tokens; and `largest`, when the
// amount is not converted at all. That last case says so in words: an input
// that changes nothing with no reason given looks broken.
function amountEntry(field, convert, { t, decimals, several }, unlimited = false) {
  const read = convert ? readAmount(field, decimals) : readCount(field);
  const label = convert ? t.amount.exact : t.amount.count;
  if (read === null) return { largest: false, entry: { label, value: asWritten(field), notes: [t.page.unreadNote] } };

  const entry = { label, value: String(read.exact), notes: [] };
  if (read.largest) {
    entry.largest = true;
    entry.notes.push(unlimited ? t.permit2.unlimited : t.amount.largest);
    if (convert) entry.notes.push(unlimited ? t.permit2.unlimitedDecimals : t.amount.largestDecimals);
  }
  if (read.amount !== undefined) entry.notes.push(fill(t.amount.stated, { decimals, amount: read.amount }));
  if (read.assumed) entry.notes.push(t.amount.decimalsUnknown, ...read.assumed.map((guess) => fill(t.amount.assumed, guess)));
  if (read.amount !== undefined || read.assumed) {
    entry.converted = true;
    if (!several) entry.decimals = true;
  }
  return { largest: read.largest, entry };
}

// A time: the date and how far it is from now, or the number as written
// with what can be said when there is no date to give.
function timeEntry(label, field, { t, now, locale, timeZone }) {
  const read = readTime(field, now);
  if (read === null) return { passed: false, entry: { label, value: asWritten(field), notes: [t.page.unreadNote] } };

  const written = String(field.value);
  if (read.zero) return { passed: true, entry: { label, value: written, notes: [t.time.zero, t.time.passed], clock: true } };
  if (read.largest) return { passed: false, entry: { label, value: written, notes: [t.time.largest] } };
  if (read.date === null) return { passed: false, entry: { label, value: written, notes: [t.time.beyondDates] } };

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'medium', timeZone }).format(
    new Date(read.date),
  );
  const passed = Number(read.fromNow) < 0;
  return {
    passed,
    entry: {
      label,
      value: `${fill(t.time.date, { date, zone: timeZone })} (${distance(Number(read.fromNow), locale)})`,
      notes: passed ? [t.time.passed] : [],
      // The distance is counted from the device's clock.
      clock: true,
    },
  };
}

// "in 30 days", "5 minutes ago": written by the language's own rules, in the
// largest unit that needs no approximation (a month is not a fixed length).
function distance(seconds, locale) {
  const size = Math.abs(seconds);
  const [unit, length] = size < 120 ? ['second', 1] : size < 7200 ? ['minute', 60] : size < 172800 ? ['hour', 3600] : ['day', 86400];
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(Math.trunc(seconds / length), unit);
}
