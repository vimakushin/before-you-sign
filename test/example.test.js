import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { example } from '../src/example.js';
import { respond } from '../src/explain.js';
import en from '../src/texts/en.js';
import ru from '../src/texts/ru.js';

const NOW = 1790000000;
const fixture = JSON.parse(readFileSync(new URL('./fixtures/permit2-permit-single.json', import.meta.url), 'utf8'));
const options = (locale) => ({ now: NOW, locale, timeZone: 'UTC' });

test('the first example is the fixture, except that its two times are counted from now', () => {
  const shown = JSON.parse(example('largest', NOW));
  assert.equal(shown.message.sigDeadline, String(NOW + 30 * 60));
  assert.equal(shown.message.details.expiration, String(NOW + 30 * 24 * 3600));
  shown.message.sigDeadline = fixture.message.sigDeadline;
  shown.message.details.expiration = fixture.message.details.expiration;
  assert.deepEqual(shown, fixture);
});

test('the second example differs from the first in the amount alone', () => {
  const first = JSON.parse(example('largest', NOW));
  const second = JSON.parse(example('particular', NOW));
  assert.notEqual(second.message.details.amount, first.message.details.amount);
  second.message.details.amount = first.message.details.amount;
  assert.deepEqual(second, first);
});

test('both examples are read, and only the second asks for the number of decimals', () => {
  for (const [language, texts] of [['en', en], ['ru', ru]]) {
    const largest = respond(example('largest', NOW), texts, options(language));
    const particular = respond(example('particular', NOW), texts, options(language));
    assert.equal(largest.refused, undefined);
    assert.equal(particular.refused, undefined);
    assert.ok(largest.details.some((entry) => entry.largest));
    assert.ok(particular.details.some((entry) => entry.decimals));
    assert.ok(!largest.details.some((entry) => entry.clock && entry.notes.length > 0));
  }
});
