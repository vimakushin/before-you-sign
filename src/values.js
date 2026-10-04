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
// parser flagged as not fitting its type is never read as a number, and
// neither is a field of any other type: an address is hexadecimal digits too.
function readUnsigned({ type, value, mismatch }) {
  const largest = largestOf(type);
  const integer = readInteger(value);
  if (mismatch || largest === null || integer === null || integer > largest) return null;
  return { integer, largest: integer === largest };
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
// has to be shown as one. The two cases are the project's choice of examples
// (TZ, section 4), not a statement that tokens come only in these two kinds.
const ASSUMED_DECIMALS = [18, 6];

// ERC-20 declares `function decimals() public view returns (uint8)`, so a
// token cannot report more than 255.
// https://github.com/ethereum/ERCs/blob/365b4c02879f3e882b91281d42b4f57b406205e9/ERCS/erc-20.md
const MOST_DECIMALS = 255;

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

  const exact = read.integer.toString();
  if (read.largest) return { exact, largest: true };
  if (Number.isInteger(decimals) && decimals >= 0 && decimals <= MOST_DECIMALS) {
    return { exact, largest: false, amount: withDecimals(read.integer, decimals) };
  }
  return {
    exact,
    largest: false,
    assumed: ASSUMED_DECIMALS.map((guess) => ({ decimals: guess, amount: withDecimals(read.integer, guess) })),
  };
}

// The furthest moment a JavaScript Date can express, in seconds: the language
// defines a Date as at most 8.64e15 milliseconds from the start of 1970. A
// uint256 deadline can be far beyond it.
const LAST_DATE = 8_640_000_000_000n;

// Takes a field holding a time in seconds since 1970, and the current time in
// seconds (Date.now() / 1000; a fraction of a second is dropped). `date` is
// in UTC and is null when the moment is beyond what a date can express;
// `fromNow` is in seconds and negative for a moment in the past.
export function readTime(field, now) {
  const read = readUnsigned(field);
  if (read === null) return null;

  const seconds = read.integer;
  return {
    seconds: seconds.toString(),
    zero: seconds === 0n,
    largest: read.largest,
    date: seconds <= LAST_DATE ? new Date(Number(seconds) * 1000).toISOString() : null,
    fromNow: (seconds - BigInt(Math.floor(now))).toString(),
  };
}
