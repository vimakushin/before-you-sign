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
import en from './texts/en.js';
import ru from './texts/ru.js';

const LANGUAGES = { en, ru };
const byId = (id) => document.getElementById(id);
const request = byId('request');
const decimals = byId('decimals');
const answer = byId('answer');

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
  byId('request-label').textContent = page.inputLabel;
  byId('decimals-label').textContent = page.decimalsLabel;
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

function showAnswer({ typed = false, scroll = false } = {}) {
  const lang = language();
  const texts = LANGUAGES[lang];
  if (typed) emptiedForSecretWords = false;
  answer.replaceChildren();
  if (request.value.trim() === '') {
    if (emptiedForSecretWords) answer.append(element('p', texts.refusal['possible-secret-words'], 'main'));
    return;
  }

  let result;
  try {
    result = respond(request.value, texts, {
      now: Date.now() / 1000,
      decimals: decimals.value === '' ? undefined : Number(decimals.value),
      locale: lang,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    answer.append(...(result.refused ? refusal(result) : explanation(result, texts)));
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
    emptiedForSecretWords = true;
  }
  // Only on a paste into the box: the decimals field is below the answer, and
  // jumping back up while a digit is being typed there would get in the way.
  if (scroll) answer.firstElementChild?.scrollIntoView({ block: 'nearest' });
}

function refusal({ refused }) {
  return refused.map((line, index) => element('p', line, index === 0 ? 'main' : undefined));
}

// Top to bottom, in the order a person needs it: the one sentence that says
// what the signature gives, what must not be missed, the details, how the
// request works, what was not checked, and last the request as written.
function explanation({ main, notable, details, mechanics, notChecked, domain, message }, { page }) {
  const list = element('ul');
  list.append(...notChecked.map((line) => element('li', line)));
  return [
    element('p', main, 'main'),
    ...notable.map((line) => element('p', line, 'notable')),
    element('h2', page.detailsTitle),
    ...details.map(entry),
    element('p', page.wallet),
    ...(mechanics.length > 0 ? [element('h2', page.mechanicsTitle), ...mechanics.map(entry)] : []),
    element('h2', page.notCheckedTitle),
    list,
    element('h2', page.contentsTitle),
    written('domain', domain, page),
    written('message', message, page),
  ];
}

// One entry of the details: a sentence, a heading, or a value from the
// request on a line of its own under a label that says what it is.
function entry(item) {
  if (typeof item === 'string') return element('p', item);
  if (item.heading) return element('h3', item.heading);
  const block = element('div', undefined, 'detail');
  block.append(element('p', item.label, 'label'));
  if (item.value !== undefined) block.append(element('p', item.value, 'value'));
  block.append(...(item.notes ?? []).map((note) => element('p', note)));
  if (item.sub?.length > 0) {
    const sub = element('div', undefined, 'sub');
    sub.append(...item.sub.map(entry));
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
  const item = element('li', children ? label : `${label}: ${asWritten(field.value)}`);

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

request.addEventListener('input', () => showAnswer({ typed: true, scroll: true }));
decimals.addEventListener('input', () => showAnswer());
addEventListener('hashchange', () => {
  showFixedTexts();
  showAnswer();
});
showFixedTexts();
