// Parsing of an EIP-712 signing request (the JSON a wallet shows for
// eth_signTypedData_v4). Text in, fields out. Nothing here explains what a
// field means or words anything for a person: this module only reads.
//
// The result is either { parsed: true, primaryType, types, domain, message }
// or { parsed: false, reason, detail? }. A refusal is a normal result, not an
// exception: people paste half a request, two requests, or something that is
// not a request at all, and each of those deserves its own answer.
//
// The names say what this module did and nothing about the request. `parsed`
// means the text was read; it used to be `ok`, which reads as "the request
// is fine", and that is a verdict this project never gives. For the same
// reason a value whose shape does not fit its declared type (not an object
// where a struct is declared, not a list where an array is, or absent) is
// marked `unread`: we could not read it as that type. It is not called a
// mismatch in the request. Only the shape is looked at here; whether a string
// in a uint256 member is a number is decided where numbers are read. And the
// refusals are 'unexpected-shape' (the JSON is not laid out the way this
// parser expects a signing request to be) and 'main-type-not-found' (the type
// named as the main one is not among the declared types).

const REQUIRED = ['types', 'primaryType', 'domain', 'message'];

export function parseRequest(pasted) {
  // String.trim also removes the non-breaking spaces and byte order marks that
  // come along when text is copied from a web page. JSON.parse treats those as
  // syntax errors, so everything below works on the trimmed text.
  const text = pasted.trim();
  if (text === '') return refuse('empty');

  let asWritten;
  let data;
  try {
    asWritten = JSON.parse(text);
    data = JSON.parse(quoteNumbers(text));
  } catch {
    return refuse(whyNotJson(text));
  }

  if (!isObject(data)) return refuse('unexpected-shape');
  for (const key of REQUIRED) {
    if (!Object.hasOwn(data, key)) return refuse('unexpected-shape', key);
  }
  const { types, primaryType, domain, message } = data;
  if (!isObject(types) || !Object.values(types).every(isTypeDefinition)) {
    return refuse('unexpected-shape', 'types');
  }
  if (typeof primaryType !== 'string') return refuse('unexpected-shape', 'primaryType');
  if (!isObject(domain)) return refuse('unexpected-shape', 'domain');
  if (!isObject(message)) return refuse('unexpected-shape', 'message');

  if (!Object.hasOwn(types, primaryType)) return refuse('main-type-not-found', primaryType);

  try {
    // The schema in EIP-712 lists EIP712Domain as a required member of `types`,
    // and the first version of this parser refused a request without it. That
    // was reversed: what a wallet shows does carry the declaration, but a person
    // may bring the same request from a developer's code, where it is often left
    // out. Refusing to read a real request costs more than reading one whose
    // domain comes without types, so the domain is then listed as written.
    const domainFields = Object.hasOwn(types, 'EIP712Domain')
      ? readStruct('EIP712Domain', domain, asWritten.domain, types)
      : Object.keys(domain).map((name) => asIs(name, domain[name], asWritten.domain[name]));

    return {
      parsed: true,
      primaryType,
      types,
      domain: domainFields,
      message: readStruct(primaryType, message, asWritten.message, types),
    };
  } catch (error) {
    // The standard allows a struct type to refer to itself, so a message or a
    // domain can be nested as deep as its author likes; around a thousand
    // levels the recursive reading below runs out of stack.
    if (error instanceof RangeError) return refuse('too-deep');
    throw error;
  }
}

function refuse(reason, detail) {
  return detail === undefined ? { parsed: false, reason } : { parsed: false, reason, detail };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTypeDefinition(members) {
  return (
    Array.isArray(members) &&
    members.every((m) => isObject(m) && typeof m.name === 'string' && typeof m.type === 'string')
  );
}

// Why every number is turned into a string before the real parse.
//
// Amounts in these requests are integers of up to 256 bits. A request may
// carry them as strings or as bare JSON numbers (the example in EIP-712
// itself writes its chain id as a bare number), and
// JSON.parse reads bare numbers as 64-bit floats: anything above 2^53 comes
// back silently rounded. A rounded amount is exactly the mistake this project
// exists to prevent, so we never let JSON.parse see a number. Every numeric
// token is wrapped in quotes first, and the digits reach the caller exactly
// as they were written.
//
// That makes a number written without quotes look like a string, and the
// difference matters: a wallet that reads the request with ordinary JSON
// parsing gets the rounded number, not these digits, and a number in a field
// declared as a string is not that string. So the text is also parsed as it
// is, for one purpose only: to see where it holds a bare number. Such a value
// is marked `bare`.
//
// The pattern matches a whole string literal or a number, whichever starts
// first, so digits inside strings are skipped over rather than touched. It is
// only applied to text that has already parsed as JSON.
function quoteNumbers(json) {
  return json.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) =>
    token[0] === '"' ? token : `"${token}"`,
  );
}

// JSON.parse only says "syntax error". The two ways a paste usually goes wrong
// are worth telling apart, because the person can fix each one differently:
// the selection stopped short (truncated), or it ran past the end of the
// request into something else, typically a second request (trailing-text).
// Both answers send the person looking for a specific fix, so neither is given
// when the brackets do not pair up or the part before the extra text is itself
// broken. "truncated" remains a best guess: a text can be cut short and wrong
// in the middle at once.
function whyNotJson(text) {
  if (text[0] !== '{' && text[0] !== '[') return 'not-json';

  const open = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{' || char === '[') open.push(char);
    else if (char === '}' || char === ']') {
      if (open.pop() !== (char === '}' ? '{' : '[')) return 'not-json';
      if (open.length === 0 && i < text.length - 1) {
        return isJson(text.slice(0, i + 1)) ? 'trailing-text' : 'not-json';
      }
    }
  }
  return open.length > 0 || inString ? 'truncated' : 'not-json';
}

function isJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// Reads the members of a struct in the order its type declares them. EIP-712,
// "Definition of encodeData": a struct is encoded as "the concatenation of
// the encoded member values in the order that they appear in the type".
// https://github.com/ethereum/EIPs/blob/3b3c832577ec4205d463d990d52006e299962449/EIPS/eip-712.md
// (retrieved 2026-10-04)
//
// A key the type does not declare has no place in that encoding. What a given
// wallet does when it meets one is not something the standard settles, so
// such a key is neither explained nor dropped: it is returned after the
// declared members, with its value as written and a flag. Dropping it was the
// first version's behaviour; it hid part of what the person had pasted
// without saying so.
//
// `asWritten` is the same object from the parse that left numbers alone.
function readStruct(typeName, object, asWritten, types) {
  const members = types[typeName];
  const declared = members.map(({ name, type }) => {
    const present = Object.hasOwn(object, name);
    return {
      name,
      ...readValue(type, present ? object[name] : undefined, present ? asWritten[name] : undefined, types),
    };
  });
  const undeclared = Object.keys(object)
    .filter((key) => !members.some(({ name }) => name === key))
    .map((name) => ({ ...asIs(name, object[name], asWritten[name]), undeclared: true }));
  return [...declared, ...undeclared];
}

// A value with no declared type to read it by: returned as it was written.
function asIs(name, value, asWritten) {
  return typeof asWritten === 'number' ? { name, value, bare: true } : { name, value };
}

// A value whose shape does not fit its declared type (a struct that is not an
// object, an array that is not a list, a member that is absent) is returned
// as is and marked `unread`, instead of failing the whole request: the rest
// of the request is still worth showing.
function readValue(type, value, asWritten, types) {
  const array = type.match(/^(.+)\[\d*\]$/);
  if (array) {
    if (!Array.isArray(value)) return { type, value, unread: true };
    return { type, items: value.map((item, index) => readValue(array[1], item, asWritten[index], types)) };
  }
  if (Object.hasOwn(types, type)) {
    if (!isObject(value)) return { type, value, unread: true };
    return { type, fields: readStruct(type, value, asWritten, types) };
  }
  if (typeof value !== 'string' && typeof value !== 'boolean') {
    return { type, value, unread: true };
  }
  return typeof asWritten === 'number' ? { type, value, bare: true } : { type, value };
}
