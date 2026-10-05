// What an answer about a request has not checked. Without this list an
// explanation reads as a verification, so no answer goes out without it: the
// function takes any parsed request and never returns an empty list.
//
// It returns codes, not wording. The wording, and the reminder that the
// thing to compare before signing is the wallet's own screen and not this
// page, belong to the page.

import { isAddress, losesDigits, notRead, readInteger } from './values.js';

const TIME_ROLES = ['signatureDeadline', 'allowanceExpiration', 'startTime', 'endTime'];

// Takes the result of parseRequest (parsed: true) and of recognise.
export function notChecked(parsed, known) {
  const fields = everyField([...parsed.domain, ...parsed.message]);
  const list = [];

  // This project never asks the network anything, so these are true of every
  // request that has the thing they speak of. A line about a token under a
  // request that has no token in it is noise, and noise teaches a person to
  // skip the list.
  const addresses = fields.some((field) => field.type === 'address' || isAddress(field.value));
  const contract = parsed.domain.some((field) => field.name === 'verifyingContract' && field.type === 'address');
  // Who is behind any address in the request.
  if (addresses) list.push('whose-addresses');
  // Whether the token is the one the person expects. Only where the answer
  // names a token: for a type we do not explain we do not know that there is one.
  if (known?.roles?.token || known?.roles?.offer) list.push('token-genuine');
  // The code at the contract's address: we say what a protocol's own source
  // says, not what this contract does.
  if (contract) list.push('contract-code');
  // The letter case of addresses, which ERC-55 uses as a checksum.
  if (addresses) list.push('address-checksum');

  // The type is not one we explain, or its shape is but the contract could
  // not be verified: either way the meaning of the members is not stated.
  if (known === null || known.unverified) list.push('meaning-of-fields');
  // A type we do not explain has no domain to compare with anything, but a
  // request that declares no domain type at all still leaves it unknown
  // whether the contract address in it is part of what gets signed.
  if (known?.unverified || !Object.hasOwn(parsed.types, 'EIP712Domain')) list.push('contract-not-established');
  // The domain was compared with a list, and no list here is complete.
  if (known?.unverified === 'domain-not-listed') list.push('published-lists-incomplete');
  // What the table in known-types.js records for this type in particular.
  list.push(...(known?.unchecked ?? []));
  // Decimals are a property of the token and are not in the request. A
  // Seaport order has no single amount: its amounts are in the items of its
  // two lists, and only an ERC20 item (itemType 1) has decimals to speak of.
  if (known?.roles?.amount || (known?.roles?.offer && mayHoldToken(parsed.message))) list.push('token-decimals');
  // "How long from now" is counted from the clock of the person's device,
  // not from the network's. If that clock is wrong, so is the distance.
  if (TIME_ROLES.some((role) => known?.roles?.[role])) list.push('device-clock');

  if (fields.some((field) => field.undeclared)) list.push('undeclared-keys');
  if (fields.some(notRead)) list.push('unread-values');
  if (fields.some(losesDigits)) list.push('bare-large-numbers');
  return list;
}

// Whether a Seaport order has an item that is, or may be, an ERC-20 token.
// The rule leans towards saying more: an item whose kind could not be read is
// counted as one that may be a token, so the note about decimals is dropped
// only when every item's kind was read and none of them is a token.
function mayHoldToken(message) {
  const items = message
    .filter((field) => field.name === 'offer' || field.name === 'consideration')
    .flatMap((list) => list.items ?? []);
  return items.some((item) => {
    const kind = readInteger(item.fields?.find((field) => field.name === 'itemType')?.value);
    return kind === null || kind === 1n;
  });
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
