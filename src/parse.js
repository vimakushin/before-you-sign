// Parsing of an EIP-712 signing request (the JSON a wallet shows for
// eth_signTypedData_v4). Text in, fields out. Nothing here explains what a
// field means or words anything for a person: this module only reads.
//
// The result is either { ok: true, primaryType, domain, message } or
// { ok: false, reason, detail? }. A refusal is a normal result, not an
// exception: people paste half a request, two requests, or something that is
// not a request at all, and each of those deserves its own answer.

const REQUIRED = ['types', 'primaryType', 'domain', 'message'];

export function parseRequest(pasted) {
  // String.trim also removes the non-breaking spaces and byte order marks that
  // come along when text is copied from a web page. JSON.parse treats those as
  // syntax errors, so everything below works on the trimmed text.
  const text = pasted.trim();
  if (text === '') return refuse('empty');

  let data;
  try {
    JSON.parse(text);
    data = JSON.parse(quoteNumbers(text));
  } catch {
    return refuse(whyNotJson(text));
  }

  if (!isObject(data)) return refuse('not-typed-data');
  for (const key of REQUIRED) {
    if (!Object.hasOwn(data, key)) return refuse('not-typed-data', key);
  }
  const { types, primaryType, domain, message } = data;
  if (!isObject(types) || !Object.values(types).every(isTypeDefinition)) {
    return refuse('not-typed-data', 'types');
  }
  if (typeof primaryType !== 'string') return refuse('not-typed-data', 'primaryType');
  if (!isObject(domain)) return refuse('not-typed-data', 'domain');
  if (!isObject(message)) return refuse('not-typed-data', 'message');

  if (!Object.hasOwn(types, primaryType)) return refuse('type-not-declared', primaryType);

  // The schema in EIP-712 lists EIP712Domain as a required member of `types`,
  // and the first version of this parser refused a request without it. That
  // was reversed: what a wallet shows does carry the declaration, but a person
  // may bring the same request from a developer's code, where it is often left
  // out. Refusing to read a real request costs more than reading one whose
  // domain comes without types, so the domain is then listed as written.
  const domainFields = Object.hasOwn(types, 'EIP712Domain')
    ? readStruct('EIP712Domain', domain, types)
    : Object.entries(domain).map(([name, value]) => ({ name, value }));

  try {
    return {
      ok: true,
      primaryType,
      domain: domainFields,
      message: readStruct(primaryType, message, types),
    };
  } catch (error) {
    // The standard allows a struct type to refer to itself, so a message can
    // be nested as deep as its author likes; around a thousand levels the
    // recursive reading below runs out of stack.
    if (error instanceof RangeError) return refuse('too-deep');
    throw error;
  }
}

function refuse(reason, detail) {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
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
// Amounts in these requests are 256-bit integers. Most dapps send them as
// strings, but nothing stops one from sending a bare JSON number, and
// JSON.parse reads bare numbers as 64-bit floats: anything above 2^53 comes
// back silently rounded. A rounded amount is exactly the mistake this project
// exists to prevent, so we never let JSON.parse see a number. Every numeric
// token is wrapped in quotes first, and the digits reach the caller exactly
// as they were written.
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

// Reads the members of a struct in the order its type declares them, which is
// the order the standard hashes them in. Keys that the type does not declare
// are not returned.
function readStruct(typeName, object, types) {
  return types[typeName].map(({ name, type }) => ({
    name,
    ...readValue(type, Object.hasOwn(object, name) ? object[name] : undefined, types),
  }));
}

// A value whose shape does not fit its declared type (a struct that is not an
// object, an array that is not a list, a member that is absent) is returned
// as is and flagged, instead of failing the whole request: the rest of the
// request is still worth showing.
function readValue(type, value, types) {
  const array = type.match(/^(.+)\[\d*\]$/);
  if (array) {
    if (!Array.isArray(value)) return { type, value, mismatch: true };
    return { type, items: value.map((item) => readValue(array[1], item, types)) };
  }
  if (Object.hasOwn(types, type)) {
    if (!isObject(value)) return { type, value, mismatch: true };
    return { type, fields: readStruct(type, value, types) };
  }
  if (typeof value !== 'string' && typeof value !== 'boolean') {
    return { type, value, mismatch: true };
  }
  return { type, value };
}
