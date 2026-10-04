// Puts an answer together out of the pieces: the parser, the table of types,
// the readers of numbers, the list of what was not checked, and the texts.
// Text in, lines of text out; nothing here touches the page, so all of it can
// be tested without a browser.
//
// The answer is { refused, clear } when the text could not be read, and
// otherwise { headline, body, notChecked, domain, message }:
//   headline    what the request says, first of all the thing that matters
//               most (an amount with no limit goes here, not into a list);
//   body        the rest, as lines and as titled groups of lines;
//   notChecked  what this answer has not checked, never empty;
//   domain, message  the fields as parsed, for showing the request as written.

import { parseRequest } from './parse.js';
import { recognise } from './known-types.js';
import { notChecked } from './unknowns.js';
import { readAmount, readCount, readTime, readInteger, notRead, losesDigits } from './values.js';
import { networkName } from './networks.js';

// `texts` is one of the files in texts/; `now` is the current time in
// seconds; `decimals` is what the person entered, if anything; `locale` and
// `timeZone` say how to write a date.
export function respond(pasted, texts, { now, decimals, locale, timeZone }) {
  const parsed = parseRequest(pasted);
  if (!parsed.parsed) return refusal(parsed, texts);

  const known = recognise(parsed);
  const say = { t: texts, now, decimals, locale, timeZone };
  const { headline, body } = known?.roles ? explained(parsed, known, say) : shownOnly(parsed, known, say);
  return {
    headline,
    body,
    notChecked: notChecked(parsed, known).map((code) => fill(texts.notChecked[code], blanksFor(code, parsed))),
    domain: parsed.domain,
    message: parsed.message,
  };
}

function refusal({ reason, detail }, t) {
  const lines = [fill(t.refusal[reason], { type: detail })];
  if (reason === 'unexpected-shape' && detail) lines.push(fill(t.refusal['unexpected-shape-part'], { part: detail }));
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

// A value for a sentence. One that is absent or that we could not read is
// never put into a sentence as if it had been read: it is shown as written,
// marked.
function shown(field, t) {
  if (field?.value !== undefined && !notRead(field)) return field.value;
  return `${field?.value === undefined ? '—' : JSON.stringify(field.value)} (${t.page.flagUnread})`;
}

// ---------------------------------------------------------------- no roles

// A type we do not explain, or one whose contract could not be established:
// what can be said without the roles.
function shownOnly(parsed, known, say) {
  const { t } = say;
  if (known) return { headline: [fill(t.domain[known.unverified], { form: t.form[known.kind] })], body: [] };

  const body = [];
  if (Object.hasOwn(parsed.types, 'EIP712Domain')) {
    // The name of a member proves nothing about what it holds: only a member
    // declared as an address and written as one is called the contract.
    const contract = declared(parsed.domain, 'verifyingContract');
    const readable = contract?.type === 'address' && !notRead(contract);
    body.push(t.domain.explained);
    body.push(readable ? fill(t.domain.contract, { address: contract.value }) : t.domain.noContract);
    body.push(...network(parsed, say));
  }
  return { headline: [fill(t.domain.unexplained, { type: parsed.primaryType })], body };
}

function network(parsed, { t }) {
  const chain = declared(parsed.domain, 'chainId');
  if (chain?.type !== 'uint256' || notRead(chain)) return [];
  const name = networkName(chain.value);
  return [fill(name ? t.domain.networkNamed : t.domain.network, { chainId: chain.value, name })];
}

// ------------------------------------------------------------------- roles

// The order of the body is the same for every type: the amount first, since
// the headline speaks of "the amount below"; then where the request is
// addressed; then the times, the signature's before the allowance's, as the
// sentence that introduces them names them.
function explained(parsed, known, say) {
  const { t } = say;
  const { message, domain } = parsed;
  const member = (name, fields = message) => declared(fields, name) ?? {};
  const address = declared(domain, 'verifyingContract')?.value;
  const spender = shown(member('spender'), t);
  const headline = [];
  const body = [];
  const matched = (text, blanks) =>
    body.push(t.domain.explained, fill(text, { address, ...blanks }), ...network(parsed, say));

  switch (known.kind) {
    case 'erc2612-permit': {
      headline.push(fill(t.erc2612.what, { spender, owner: shown(member('owner'), t) }));
      const amount = amountLines(member('value'), true, say);
      if (amount.largest) headline.push(t.amount.largest, t.amount.largestUnexplained);
      body.push(...amount.lines);
      body.push(known.roles.token ? fill(t.erc2612.token, { token: address }) : t.erc2612.tokenMissing);
      body.push(...network(parsed, say));
      body.push(fill(t.erc2612.deadline, { time: timeText(member('deadline'), say) }));
      break;
    }
    case 'dai-permit': {
      const allowed = member('allowed');
      const who = { spender, holder: shown(member('holder'), t) };
      headline.push(t.dai.what);
      headline.push(
        allowed.unread || typeof allowed.value !== 'boolean'
          ? fill(t.dai.unread, { value: JSON.stringify(allowed.value) ?? '—' })
          : fill(allowed.value ? t.dai.yes : t.dai.no, who),
      );
      matched(t.domain.dai);
      const expiry = member('expiry');
      body.push(
        readTime(expiry, say.now)?.zero ? t.dai.expiryZero : fill(t.dai.expiry, { time: timeText(expiry, say) }),
      );
      break;
    }
    case 'permit2-permit-single': {
      const details = member('details').fields ?? [];
      // The headline already says the amount is the largest and what Permit2
      // calls that, so the line under the number does not say it again.
      const amount = amountLines(member('amount', details), true, say, false);
      headline.push(fill(t.permit2.single, { spender, token: shown(member('token', details), t) }));
      if (amount.largest) headline.push(t.permit2.unlimited);
      body.push(...amount.lines);
      matched(t.domain.permit2);
      body.push(t.permit2.owner, t.permit2.twoTimes);
      body.push(fill(t.permit2.sigDeadline, { time: timeText(member('sigDeadline'), say) }));
      body.push(expirationLine(member('expiration', details), say));
      break;
    }
    case 'permit2-permit-batch': {
      // Each entry says for itself whether its amount is the largest: with
      // several tokens, the headline alone would not say which one it is.
      const entries = (member('details').items ?? []).map((entry) => {
        const details = entry.fields ?? [];
        const amount = amountLines(member('amount', details), true, say);
        return {
          largest: amount.largest,
          title: fill(t.permit2.batchToken, { token: shown(member('token', details), t) }),
          lines: [...amount.lines, expirationLine(member('expiration', details), say)],
        };
      });
      headline.push(fill(t.permit2.batch, { spender }));
      if (entries.some((entry) => entry.largest)) headline.push(t.permit2.unlimitedInBatch);
      body.push(...entries.map(({ title, lines }) => ({ title, lines })));
      matched(t.domain.permit2);
      body.push(t.permit2.owner, t.permit2.twoTimes);
      body.push(fill(t.permit2.sigDeadline, { time: timeText(member('sigDeadline'), say) }));
      break;
    }
    case 'permit2-permit-transfer-from': {
      const permitted = member('permitted').fields ?? [];
      const amount = amountLines(member('amount', permitted), true, say, false);
      headline.push(fill(t.permit2.transfer, { spender, token: shown(member('token', permitted), t) }));
      if (amount.largest) headline.push(t.amount.largest, t.amount.largestUnexplained);
      headline.push(fill(t.permit2.transferRecipient, { spender }));
      body.push(...amount.lines);
      matched(t.domain.permit2);
      body.push(fill(t.permit2.transferDeadline, { time: timeText(member('deadline'), say) }));
      break;
    }
    case 'seaport-order': {
      const items = (name) => (member(name).items ?? []).map((item) => itemLine(item.fields ?? [], known, say));
      headline.push(t.seaport.what);
      body.push({ title: t.seaport.offer, lines: items('offer') }, t.seaport.offerRecipient);
      body.push({ title: t.seaport.consideration, lines: items('consideration') }, t.seaport.extended);
      matched(t.domain.seaport, { version: declared(domain, 'version')?.value });
      body.push(fill(t.seaport.starts, { time: timeText(member('startTime'), say) }));
      body.push(fill(t.seaport.ends, { time: timeText(member('endTime'), say) }));
      break;
    }
  }
  return { headline, body };
}

// The expiration of a Permit2 allowance: zero has a meaning of its own there.
function expirationLine(field, say) {
  const { t } = say;
  return readTime(field, say.now)?.zero
    ? t.permit2.expirationZero
    : fill(t.permit2.expiration, { time: timeText(field, say) });
}

// One item of a Seaport order as a single line.
function itemLine(fields, known, say) {
  const { t } = say;
  const member = (name) => declared(fields, name) ?? {};
  const kind = known.itemKinds[Number(readInteger(member('itemType').value) ?? -1)];
  if (!kind) return `itemType: ${shown({ ...member('itemType'), unread: true }, t)}`;

  const id = member('identifierOrCriteria');
  const parts = [fill(t.seaport[kind], { token: shown(member('token'), t), id: shown(id, t) }) + '.'];
  if (kind.endsWith('criteria') && readInteger(id.value) === 0n) parts.push(t.seaport.anyItem);

  // Only an ERC-20 amount is converted by decimals: see known-types.js.
  const convert = kind === 'erc20';
  const read = (field) => (convert ? readAmount(field, say.decimals) : readCount(field));
  const start = member('startAmount');
  const end = member('endAmount');
  const [from, to] = [read(start), read(end)];
  if (from === null || to === null || from.exact === to.exact) {
    parts.push(...amountLines(from === null ? start : end, convert, say).lines);
  } else {
    // Two amounts, and each is converted like any other: the number of
    // decimals the person entered, or the two marked guesses.
    parts.push(fill(t.seaport.amountChanges, { start: from.exact, end: to.exact }));
    const pair = (a, b) => `${a ?? t.amount.largest} → ${b ?? t.amount.largest}`;
    if (from.amount !== undefined || to.amount !== undefined) {
      parts.push(fill(t.amount.stated, { decimals: say.decimals, amount: pair(from.amount, to.amount) }));
    } else if (from.assumed || to.assumed) {
      parts.push(t.amount.decimalsUnknown);
      for (const [index, { decimals }] of (from.assumed ?? to.assumed).entries()) {
        parts.push(fill(t.amount.assumed, { decimals, amount: pair(from.assumed?.[index].amount, to.assumed?.[index].amount) }));
      }
    }
  }
  const recipient = declared(fields, 'recipient');
  if (recipient) parts.push(fill(t.seaport.recipient, { address: shown(recipient, t) }));
  return parts.join(' ');
}

// ------------------------------------------------------- amounts and times

// The lines that state an amount, and whether it is the largest its field
// holds. `markLargest` is off only where the headline has just said so.
function amountLines(field, convert, { t, decimals }, markLargest = true) {
  const read = convert ? readAmount(field, decimals) : readCount(field);
  if (read === null) return { largest: false, lines: [fill(t.amount.unread, { value: shown({ ...field, unread: true }, t) })] };

  const lines = [fill(convert ? t.amount.exact : t.amount.count, read)];
  if (read.amount !== undefined) lines.push(fill(t.amount.stated, { decimals, amount: read.amount }));
  if (read.assumed) lines.push(t.amount.decimalsUnknown, ...read.assumed.map((guess) => fill(t.amount.assumed, guess)));
  if (read.largest && markLargest) lines.push(t.amount.largest);
  return { largest: read.largest, lines };
}

// What goes after a time label: the date and how far it is from now, or what
// can be said when there is no date to give.
function timeText(field, { t, now, locale, timeZone }) {
  const read = readTime(field, now);
  if (read === null) return shown({ ...field, unread: true }, t);

  const passed = read.date !== null && Number(read.fromNow) < 0;
  if (read.zero) return [t.time.zero, t.time.passed].join(' ');
  if (read.largest) return t.time.largest;
  if (read.date === null) return t.time.beyondDates;

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'medium', timeZone }).format(
    new Date(read.date),
  );
  const written = `${fill(t.time.date, { date, zone: timeZone })} (${distance(Number(read.fromNow), locale)})`;
  return passed ? `${written}. ${t.time.passed}` : written;
}

// "in 30 days", "5 minutes ago": written by the language's own rules, in the
// largest unit that needs no approximation (a month is not a fixed length).
function distance(seconds, locale) {
  const size = Math.abs(seconds);
  const [unit, length] = size < 120 ? ['second', 1] : size < 7200 ? ['minute', 60] : size < 172800 ? ['hour', 3600] : ['day', 86400];
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(Math.trunc(seconds / length), unit);
}
