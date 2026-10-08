import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../src/texts/en.js';

// Название и описание стоят в разметке ради поисковика и ссылки, которую
// кому-то прислали: скрипт там не выполняется. Те же слова есть в
// src/texts/en.js; здесь следим, чтобы они не разошлись.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('title в index.html совпадает с английским названием из текстов', () => {
  assert.equal(html.match(/<title>([^<]*)<\/title>/)[1], en.page.title);
});

test('description в index.html совпадает с английским вступлением из текстов', () => {
  assert.equal(html.match(/name="description"\s+content="([^"]*)"/)[1], en.page.lead);
});
