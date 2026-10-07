import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/texts/en.js';
import ru from '../src/texts/ru.js';
import { readFileSync } from 'node:fs';

// Every text as "group.key" → string.
function flat(texts) {
  return Object.fromEntries(
    Object.entries(texts).flatMap(([group, strings]) =>
      Object.entries(strings).map(([key, text]) => [`${group}.${key}`, text]),
    ),
  );
}

const placeholders = (text) => (text.match(/\{[a-zA-Z]+\}/g) ?? []).sort();

test('the two languages have the same texts with the same blanks to fill', () => {
  const english = flat(en);
  const russian = flat(ru);
  assert.deepEqual(Object.keys(russian), Object.keys(english));
  for (const [key, text] of Object.entries(english)) {
    assert.deepEqual(placeholders(russian[key]), placeholders(text), key);
  }
});

// Words that turn a translation into a verdict. This is a tripwire, not a
// proof: a sentence can judge without any of them. "Verified" is here because
// block explorers use it to mean "the source code is published", which is not
// what this project compares. "Offer", "consideration" and "allowed" are words
// of Seaport and DAI that read differently in a sentence than in the protocol,
// "unfamiliar" reads as "suspicious", and "parsed" and "unread" are the code's
// words for its own work. The Russian list has no counterparts for "offer" and
// "allowed": the words that would stand for them ("предложение", "разрешение")
// are ordinary words the texts need.
const VERDICT_WORDS = {
  en: /\b(safe\w*|unsafe|secure|insecure|danger\w*|scam\w*|fraud\w*|phishing|malicious|harmful|suspicious|legit\w*|official|authentic|reliable|clean|\w*trust\w*|verif\w*|unverif\w*|unfamiliar|offer\w*|consideration|allowed|parsed|unread|fake|genuine|risky|harmless|known|unknown|recognis\w*|recogniz\w*)\b/i,
  ru: /безопасн|опасн|мошенн|обман|афер|фишинг|подозрит|поддельн|подделк|над[её]жн|доверенн|проверенн|сверен|настоящ|вредонос|рискован|угроз|(?<![а-яё])чист|знаком|опознан|известн/i,
};

test('no text carries a word that reads as a verdict', () => {
  for (const [language, texts] of [['en', en], ['ru', ru]]) {
    for (const [key, text] of Object.entries(flat(texts))) {
      assert.equal(VERDICT_WORDS[language].test(text), false, `${language} ${key}: ${text}`);
    }
  }
});

// Every code the code can produce has a sentence in the reference language
// (and so, by the first test, in the other one). The codes are picked out of
// the source text, which is crude, but a code renamed in one place and not
// the other would otherwise show up on the page as an empty line.
test('every code the code can produce has a text', () => {
  const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const all = (text, pattern) => [...text.matchAll(pattern)].map((match) => match[1]);
  const listed = (text, pattern) => all(text, pattern).flatMap((list) => all(list, /'([a-z0-9-]+)'/g));

  const parse = source('parse.js');
  const known = source('known-types.js');
  const unknowns = source('unknowns.js');

  const expected = {
    refusal: [...all(parse, /refuse\('([a-z-]+)'/g), ...all(parse, /return '([a-z-]+)'/g), 'truncated'],
    notChecked: [
      ...all(unknowns, /list\.push\('([a-z0-9-]+)'\)/g),
      ...listed(known, /unchecked: \[([^\]]*)\]/g),
    ],
    form: all(known, /kind: '([^']+)'/g),
    domain: all(known, /'(domain-not-[a-z]+)'/g),
    seaport: listed(known, /itemKinds: \[([^\]]*)\]/g),
  };
  for (const [group, codes] of Object.entries(expected)) {
    assert.ok(codes.length > 0, group);
    for (const code of codes) assert.equal(typeof en[group][code], 'string', `${group}.${code}`);
  }
});
