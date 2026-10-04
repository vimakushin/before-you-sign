// What an answer about a request has not checked. Without this list an
// explanation reads as a verification, so no answer goes out without it: the
// function takes any parsed request and never returns an empty list.
//
// It returns codes, not wording. The wording, and the reminder that the
// thing to compare before signing is the wallet's own screen and not this
// page, belong to the page.

import { losesDigits } from './values.js';

// True of every request, whatever is in it: this project never asks the
// network anything.
const ALWAYS = [
  'whose-addresses', // who is behind any address in the request
  'token-genuine', // whether the token is the one its name suggests
  'after-signing', // what the contract will do once it has the signature
];

// Takes the result of parseRequest (parsed: true) and of recognise.
export function notChecked(parsed, known) {
  const fields = everyField([...parsed.domain, ...parsed.message]);
  const list = [...ALWAYS];

  // The type is not one we explain, or its shape is but the contract could
  // not be verified: either way the meaning of the members is not stated.
  if (known === null || known.unverified) list.push('meaning-of-fields');
  if (known?.unverified) list.push('contract-not-verified');
  // An ERC-2612 permit is explained by what the standard says. Any token can
  // ask for this shape; whether this one does what the standard says is not
  // something the request shows.
  if (known?.kind === 'erc2612-permit' && known.roles) list.push('token-follows-standard');
  // Decimals are a property of the token and are not in the request. A
  // Seaport order has no single amount: its amounts are in the items of its
  // two lists.
  if (known?.roles?.amount || known?.roles?.offer) list.push('token-decimals');

  if (fields.some((field) => field.undeclared)) list.push('undeclared-keys');
  if (fields.some((field) => field.unread)) list.push('unread-values');
  if (fields.some(losesDigits)) list.push('bare-large-numbers');
  return list;
}

// Every field at every depth. Not recursive: a request can nest deeper than
// the stack goes, and this function must answer for any request the parser
// accepted.
function everyField(top) {
  const found = [];
  const pending = [...top];
  while (pending.length > 0) {
    const field = pending.pop();
    found.push(field);
    pending.push(...(field.fields ?? []), ...(field.items ?? []));
  }
  return found;
}
