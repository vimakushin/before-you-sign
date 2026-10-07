// Reading the numbers in a request: amounts and times. Arithmetic only. What
// a number means in a particular type (which member is the amount, whether
// the largest amount is "no limit", what a zero deadline does) is recorded in
// known-types.js next to its source, not here.
//
// Sources below were retrieved on 2026-10-04.

// A request can write an integer in more than one way, and a mistake about
// which way multiplies or divides someone's money. Two notations are read:
// plain decimal digits, and hexadecimal digits after "0x". Anything else
// ("1e30", "1.5", "-5", an empty string, digits with a space) is not read as
// a number at all, and the caller shows it as it was written.
//
// This is deliberately narrower than what a signing library may accept.
// MetaMask's eth-sig-util, for one, passes the value to JavaScript's BigInt(),
// which also takes binary and octal notation, surrounding whitespace, and an
// empty string as zero:
// https://github.com/MetaMask/eth-sig-util/blob/996ac292fe455429e76eff9576a5bd896cfe0952/src/sign-typed-data.ts
// The two notations read here are ones BigInt() reads as the same number.
export function readInteger(value) {
  if (typeof value !== 'string') return null;
  return /^\d+$/.test(value) || /^0x[0-9a-fA-F]+$/.test(value) ? BigInt(value) : null;
}

// An address as EIP-712 encodes it, 160 bits ("Addresses are encoded as
// uint160"): "0x" and 40 hexadecimal digits.
//
// The case of the letters is not looked at. ERC-55 uses it as a checksum
// against mistyped addresses ("if the `i`th digit is a letter ... print it in
// uppercase if the `4*i`th bit of the hash of the lowercase hexadecimal
// address is 1 otherwise print it in lowercase"). Checking it needs that
// hash, which this project does not compute, so an address with a broken
// checksum is read like any other; the list in unknowns.js says so.
// https://github.com/ethereum/ERCs/blob/365b4c02879f3e882b91281d42b4f57b406205e9/ERCS/erc-55.md
//
// The standard is called ERC-55, and that is settled: its file in the EIPs
// repository holds only "category: ERC", "status: Moved" and a link to the
// ERCs repository, where the text lives under that name.
// https://github.com/ethereum/EIPs/blob/25cdf1d059778236e28bf22d752ca48a35af91f6/EIPS/eip-55.md
// Checked by the owner and again by Claude, 7 October 2026.
export function isAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

// The largest number an unsigned integer type can hold: 2^N - 1 for uintN.
// Only the sizes EIP-712 has are answered ("The atomic types are bytes1 to
// bytes32, uint8 to uint256, int8 to int256, bool and address. These
// correspond to their definition in Solidity", where sizes go in steps of 8).
// The type is whatever the pasted request says, so "uint0" or a size with a
// hundred digits gets no answer rather than a wrong or an endless one.
// https://github.com/ethereum/EIPs/blob/3b3c832577ec4205d463d990d52006e299962449/EIPS/eip-712.md
export function largestOf(type) {
  const bits = Number(/^uint([1-9]\d{0,2})$/.exec(type)?.[1]);
  return bits % 8 === 0 && bits <= 256 ? 2n ** BigInt(bits) - 1n : null;
}

// An unsigned integer that fits its declared type, or null. A field the
// parser could not read as its type is never read as a number, and neither
// is a field of any other type: an address is hexadecimal digits too.
//
function readUnsigned(field) {
  const { type, value, unread } = field;
  const largest = largestOf(type);
  const integer = readInteger(value);
  if (unread || largest === null || integer === null || integer > largest) return null;
  const read = { integer, largest: integer === largest };
  return losesDigits(field) ? { ...read, rounding: true } : read;
}

// Whether a field holds something this project could not read. It covers the
// parser's own mark and the two kinds of value read here, unsigned integers
// and addresses: "abc" or "1e30" in a uint256 member, a word where an address
// is declared. It is a minimum, not a validation of the request: strings,
// booleans, byte strings and signed integers are not examined at all, and
// "not read" says only that, never that the value is wrong.
export function notRead(field) {
  if (field.unread) return true;
  if (field.undeclared || field.fields || field.items) return false;
  if (field.type === 'address') return !isAddress(field.value);
  return largestOf(field.type) !== null && readUnsigned(field) === null;
}

// Whether a field holds an integer that the request writes without quotes and
// that JavaScript's own number cannot hold: turned into a number and back, it
// comes out as different digits. (Not every large number does: 2^60 survives.)
// The digits this project shows are the ones written. A wallet that reads the
// request with ordinary JSON parsing would have the other number, so for such
// a value what gets signed depends on the wallet. Whether any wallet reads
// requests that way, and whether it would then sign or refuse, was not
// checked.
export function losesDigits({ value, bare }) {
  const integer = bare ? readInteger(value) : null;
  return integer !== null && BigInt(Number(integer)) !== integer;
}

// The marks every reading carries: the exact digits, whether they are the
// largest the type holds, and `dependsOnWallet` for the case above.
function marks({ integer, largest, rounding }) {
  const exact = integer.toString();
  return rounding ? { exact, largest, dependsOnWallet: true } : { exact, largest };
}

// Moves the decimal point `decimals` places to the left, exactly. No rounding
// and no floating point: 1 with 18 decimals is 0.000000000000000001.
// `decimals` must be a whole number that is not negative.
export function withDecimals(integer, decimals) {
  const digits = integer.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

// How many decimals a token has is a property of the token, known only from
// the network, which this project never asks. Showing 18 decimals for a token
// that has 6 shows an amount a trillion times too small. So the exact integer
// is always returned, and a converted amount comes in one of two forms:
// `amount`, when the person has said how many decimals the token has, or
// `assumed`, a conversion for each of two cases, each of which is a guess and
// has to be shown as one. The two cases are the project's choice of examples,
// not a statement that tokens come only in these two kinds.
const ASSUMED_DECIMALS = [18, 6];

// ERC-20 declares `function decimals() public view returns (uint8)`, so a
// token cannot report more than 255.
// https://github.com/ethereum/ERCs/blob/365b4c02879f3e882b91281d42b4f57b406205e9/ERCS/erc-20.md
const MOST_DECIMALS = 255;

// Whether a value can be a token's number of decimals. The page uses the same
// rule to tell the person that what they typed was not used.
export function validDecimals(decimals) {
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= MOST_DECIMALS;
}

// Takes a field of the parse result and, if the person stated it, the number
// of decimals. Anything that is not a whole number from 0 to 255 (an empty
// input box, a typo) counts as not stated: the answer then carries guesses
// marked as guesses, never a conversion nobody asked for.
//
// `largest` says the amount is the largest number its declared type can hold;
// converting that number is pointless, so it comes without conversions.
export function readAmount(field, decimals) {
  const read = readUnsigned(field);
  if (read === null) return null;

  if (read.largest) return marks(read);
  if (validDecimals(decimals)) {
    return { ...marks(read), amount: withDecimals(read.integer, decimals) };
  }
  return {
    ...marks(read),
    assumed: ASSUMED_DECIMALS.map((guess) => ({ decimals: guess, amount: withDecimals(read.integer, guess) })),
  };
}

// A quantity that has no decimals to convert by: an item of a collection, or
// the network's own coin, whose decimals this project does not convert by
// either. The exact number and whether it is the largest its type holds.
export function readCount(field) {
  const read = readUnsigned(field);
  return read === null ? null : marks(read);
}

// The furthest moment a JavaScript Date can express, in seconds: the language
// defines a Date as at most 8.64e15 milliseconds from the start of 1970. A
// uint256 deadline can be far beyond it.
const LAST_DATE = 8_640_000_000_000n;

// Takes a field holding a time in seconds since 1970, and the current time in
// seconds (Date.now() / 1000; a fraction of a second is dropped). `date` is
// in UTC and is null when the moment is beyond what a date can express;
// `fromNow` is in seconds and negative for a moment in the past.
//
// There is no "practically forever" here. Any distance chosen to mean that
// would be a number picked out of the air. The date and the distance are
// given as they are, and `largest` says when the field holds the largest
// number it can: nothing later fits in it.
export function readTime(field, now) {
  const read = readUnsigned(field);
  if (read === null) return null;

  const seconds = read.integer;
  return {
    ...marks(read),
    zero: seconds === 0n,
    date: seconds <= LAST_DATE ? new Date(Number(seconds) * 1000).toISOString() : null,
    fromNow: (seconds - BigInt(Math.floor(now))).toString(),
  };
}
