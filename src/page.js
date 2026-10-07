// The page itself: reads the box, asks explain.js for an answer, and puts the
// answer on screen. No logic about requests lives here.
//
// Everything that comes from the pasted request reaches the screen through
// textContent and nothing else. A request can hold anything, markup included,
// and markup put into the page as it is would run in the browser of someone
// who came here to check a request before signing it. There is no innerHTML
// in this file, and there must never be.
//
// Nothing is stored and nothing is sent: there is no fetch, no storage, no
// cookie here, and the Content-Security-Policy in index.html refuses such
// requests even if one were added.

import { respond } from './explain.js';
import { validDecimals } from './values.js';
import { example } from './example.js';
import en from './texts/en.js';
import ru from './texts/ru.js';

const LANGUAGES = { en, ru };
const byId = (id) => document.getElementById(id);
const request = byId('request');
const decimals = byId('decimals');
const answer = byId('answer');
// The decimals field is moved into the answer, next to the amount it is
// about, and out again. It is found once, here: an element that is not on
// the page at the moment cannot be found by its id.
const decimalsField = byId('decimals-field');
const decimalsLabel = byId('decimals-label');
const decimalsNote = byId('decimals-note');

// English unless the address ends in #ru. The choice lives in the address
// and nowhere else, so a link to the page carries its language with it.
function language() {
  return location.hash === '#ru' ? 'ru' : 'en';
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function showFixedTexts() {
  const lang = language();
  const { page } = LANGUAGES[lang];
  document.documentElement.lang = lang;
  document.title = page.title;
  byId('title').textContent = page.title;
  byId('lead').textContent = page.lead;
  byId('when').textContent = page.when;
  byId('how').textContent = page.how;
  byId('example-largest').textContent = page.exampleLargest;
  byId('example-particular').textContent = page.exampleParticular;
  byId('gift-text').textContent = page.gift;
  byId('gift-address').textContent = page.giftAddress;
  byId('gift-apart').textContent = page.giftApart;
  byId('request-label').textContent = page.inputLabel;
  decimalsLabel.textContent = page.decimalsLabel;
  byId('keys').textContent = page.keys;
  byId('not-sent').textContent = page.notSent;
  for (const link of document.querySelectorAll('nav a')) {
    link.setAttribute('aria-current', String(link.getAttribute('href') === `#${lang}`));
  }
}

// True from the moment the box was emptied because the text looked like a
// recovery phrase until something else is typed. The notice has to survive a
// change of language, and the text that caused it is gone, as it should be.
let emptiedForSecretWords = false;

// True from a press of an Example button until the box is typed in. While it
// is true the answer starts with a line saying that the request is an example,
// and the line follows a change of language like the rest of the answer.
let showingExample = false;

function showAnswer({ typed = false, scroll = false } = {}) {
  const lang = language();
  const texts = LANGUAGES[lang];
  if (typed) {
    emptiedForSecretWords = false;
    // A number of decimals belongs to the token of the request it was typed
    // for. Carried over to the next request it would convert another token's
    // amount, a trillion times off, under the words "you entered".
    decimals.value = '';
  }
  decimalsField.hidden = true;
  answer.replaceChildren();
  byId('pasted').textContent = request.value === '' ? '' : texts.page.pasted.replace('{count}', request.value.length);
  if (request.value.trim() === '') {
    if (emptiedForSecretWords) answer.append(element('p', texts.refusal['possible-secret-words'], 'main'));
    return;
  }

  let result;
  try {
    result = respond(request.value, texts, options(lang, texts));
    answer.append(...(result.refused ? refusal(result) : explanation(result, texts, true)));
    if (showingExample && !result.refused) answer.prepend(element('p', texts.page.exampleNote, 'example'));
  } catch (error) {
    // Drawing a request nested very deep can run out of stack the same way
    // reading it can. The answer is the same refusal, not a blank page.
    if (!(error instanceof RangeError)) throw error;
    answer.replaceChildren(element('p', texts.refusal['too-deep'], 'main'));
    return;
  }
  // The box is emptied when the text looked like a recovery phrase.
  if (result.clear) {
    request.value = '';
    byId('pasted').textContent = '';
    emptiedForSecretWords = true;
  }
  // Only on a paste into the box or a press of an Example button, not on a
  // change of language. After an example the screen starts at the line that
  // says it is an example: the sentence under it is what the button is for,
  // and a screen that kept the box on top left it below the fold.
  if (scroll) answer.firstElementChild?.scrollIntoView({ block: showingExample ? 'start' : 'nearest' });
}

// What explain.js needs besides the text. A value that cannot be a number of
// decimals is not used, and the person is told so rather than left to guess.
// An empty box is not a value.
function options(lang, texts) {
  const stated = decimals.value === '' ? undefined : Number(decimals.value);
  const rejected = decimals.validity.badInput || (stated !== undefined && !validDecimals(stated));
  decimalsNote.textContent = rejected ? texts.page.decimalsRejected : '';
  return {
    now: Date.now() / 1000,
    decimals: stated,
    locale: lang,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// A digit typed into the decimals field changes only the lines under the
// amounts. Those lines are replaced, and nothing else on the page is touched.
// The field itself stays where it is: taking an input off the page and
// putting it back on every keystroke closes the keyboard on a phone after
// the first digit.
function showConversions() {
  const texts = LANGUAGES[language()];
  let drawn;
  try {
    const result = respond(request.value, texts, options(language(), texts));
    if (result.refused) return showAnswer();
    drawn = element('div');
    drawn.append(...explanation(result, texts, false));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return showAnswer();
  }
  const shown = answer.querySelectorAll('.detail');
  const fresh = drawn.querySelectorAll('.detail');
  // The same request gives the same entries in the same order. If it ever
  // does not, drawing everything again is right and losing the keyboard is
  // the lesser harm.
  if (shown.length !== fresh.length) return showAnswer();
  shown.forEach((block, index) => {
    for (const note of block.querySelectorAll(':scope > .note')) note.remove();
    const above =
      block.querySelector(':scope > #decimals-field') ?? block.querySelector(':scope > .value') ?? block.querySelector(':scope > .label');
    above.after(...fresh[index].querySelectorAll(':scope > .note'));
  });
}

function refusal({ refused }) {
  return refused.map((line, index) => element('p', line, index === 0 ? 'main' : undefined));
}

// Top to bottom, in the order a person needs it: the one sentence that says
// what the signature gives, what must not be missed, the one thing the page
// asks the person to do (compare with the wallet), the details, how the
// request works, what was not checked, and last the request as written.
//
// `placeField` is false when the answer is drawn only to take the lines
// under the amounts from it: the decimals field then stays where it is.
function explanation({ main, notable, compare, details, mechanics, notChecked, domain, message }, { page }, placeField) {
  const entry = (item) => drawEntry(item, placeField);
  const list = element('ul');
  list.append(...notChecked.map((line) => element('li', line)));
  return [
    element('p', main, 'main'),
    ...notable.map(framed),
    element('p', page.wallet, 'wallet'),
    ...(compare ? [element('p', compare, 'compare')] : []),
    element('h2', page.detailsTitle),
    ...details.map(entry),
    ...(mechanics.length > 0 ? [element('h2', page.mechanicsTitle), ...mechanics.map(entry)] : []),
    element('h2', page.notCheckedTitle),
    list,
    element('h2', page.contentsTitle),
    written('domain', domain, page),
    written('message', message, page),
  ];
}

// What must not be missed: the fact, and under it in the same frame what the
// protocol's own source says follows from it.
function framed({ text, note }) {
  const frame = element('div', undefined, 'notable');
  frame.append(element('p', text, 'fact'));
  if (note) frame.append(element('p', note));
  return frame;
}

// A value from the request. An address is compared by eye, character by
// character, and a line that breaks wherever it runs out of room leaves two
// stray characters on a line of their own. So an address is cut into groups
// of four and into two halves: it stays on one line where it fits and
// otherwise breaks in the middle, never inside a group. Nothing is added to
// it: the gaps are spacing, and a copy of it has no spaces.
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
function valueNode(tag, text, className) {
  if (!ADDRESS.test(text)) return element(tag, text, className);
  const groups = [text.slice(0, 6), ...text.slice(6).match(/.{4}/g)].map((group) => element('span', group, 'group'));
  const node = element(tag, undefined, className);
  for (const half of [groups.slice(0, 5), groups.slice(5)]) {
    const part = element('span', undefined, 'half');
    part.append(...half);
    node.append(part);
  }
  return node;
}

// One entry of the details: a sentence, a heading, or a value from the
// request on a line of its own under a label that says what it is.
function drawEntry(item, placeField) {
  if (typeof item === 'string') return element('p', item);
  if (item.heading) return element('h3', item.heading);
  const block = element('div', undefined, 'detail');
  block.append(element('p', item.label, 'label'));
  if (item.value !== undefined) block.append(valueNode('p', item.value, 'value'));
  // The field for the token's decimals goes under the first amount that is
  // converted by them, and above the lines that say what the amount would be
  // without them: a person should see first that the number can be entered,
  // and only then the guesses for when it is not known.
  if (placeField && item.decimals && decimalsField.hidden) {
    decimalsField.hidden = false;
    block.append(decimalsField);
  }
  block.append(...(item.notes ?? []).map((note) => element('p', note, 'note')));
  if (item.sub?.length > 0) {
    const sub = element('div', undefined, 'sub');
    sub.append(...item.sub.map((child) => drawEntry(child, placeField)));
    block.append(sub);
  }
  return block;
}

// The request as it is written: every field, its declared type, its value.
function written(name, fields, page) {
  const list = element('ul', undefined, 'written');
  list.append(...fields.map((field) => writtenField(field, page)));
  const top = element('ul', undefined, 'written');
  const item = element('li', name);
  item.append(list);
  top.append(item);
  return top;
}

function writtenField(field, page) {
  const label = [field.name, field.type && `(${field.type})`].filter(Boolean).join(' ');
  const children = field.fields ?? field.items;
  const item = element('li', children ? label : `${label}: `);
  if (!children) item.append(valueNode('span', asWritten(field.value)));

  const flags = [
    field.undeclared && page.flagUndeclared,
    field.unread && page.flagUnread,
    field.bare && page.flagBare,
  ].filter(Boolean);
  if (flags.length > 0) item.append(' ', element('span', `(${flags.join(', ')})`, 'flag'));

  if (children) {
    const list = element('ul');
    list.append(...children.map((child, index) => writtenField({ name: `[${index}]`, ...child }, page)));
    item.append(list);
  }
  return item;
}

function asWritten(value) {
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
}

request.addEventListener('input', () => {
  showingExample = false;
  showAnswer({ typed: true, scroll: true });
});
for (const kind of ['largest', 'particular']) {
  byId(`example-${kind}`).addEventListener('click', () => {
    // Text in the box is the person's request, and getting it out of the
    // wallet again is the very trouble the buttons are there to spare. An
    // example already in the box is not theirs, and is replaced without asking.
    if (request.value.trim() !== '' && !showingExample && !confirm(LANGUAGES[language()].page.replaceAsk)) return;
    request.value = example(kind, Date.now() / 1000);
    showingExample = true;
    showAnswer({ typed: true, scroll: true });
  });
}
decimals.addEventListener('input', showConversions);
addEventListener('hashchange', () => {
  showFixedTexts();
  showAnswer();
});
// The author's address for gifts, in groups like an address from a request.
// It is the one address on the page that did not come from a request, and the
// last block of the page sets it apart from them in place and in type. It does
// not depend on the language, so it is drawn once.
//
// Written with the capital letters of the EIP-55 checksum. The page tells a
// person that those letters are a checksum against typing mistakes, and its
// own address without them would show the opposite. The checksum was computed
// by the owner on 7 October 2026, and the calculation was checked on the
// address given in the text of EIP-55 itself. The same address, in the same
// letters, is in both READMEs: a copy kept in the repository's history that a
// changed page would disagree with.
byId('gift-value').replaceWith(valueNode('p', '0xF65e04f7b5761b6BDc42726A54eE467736D0ca74', 'gift-value'));
showFixedTexts();
