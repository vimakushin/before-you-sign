// Everything the page says to a person, in English. English is the reference
// version; ru.js mirrors it key for key.
//
// Each sentence states something the project is entitled to state: what is
// visible in the request, what follows from it by arithmetic, or what a
// protocol's own source says (the sources are quoted in known-types.js and
// values.js). Nothing here says whether to sign, and nothing calls anyone a
// fraud. Words in {braces} are filled in by the page.
//
// Times are written as labels ("Signature deadline: {time}") rather than as
// sentences ("can be used until {time}"), so that whatever the page puts in
// the blank still reads: a date, a date already past, or the note that the
// number is the largest its field can hold.

export default {
  page: {
    notSent:
      'This page does not send the text you paste anywhere. Its code makes no network requests, and the code is open, so anyone who reads code can check.',
    keys: 'We never ask for a recovery phrase or a private key. If anyone else asks you for one, that is a reason to stop.',
    wallet:
      'This page is an explanation, not a copy of what you sign. Compare it with what your wallet shows before you sign.',
    notCheckedTitle: 'What we have not checked',
    title: 'Before you sign',
    lead: 'Paste the signing request your wallet is showing you. This page describes what the request says, as far as we can read it. It does not tell you whether to sign it.',
    inputLabel: 'Signing request (the JSON your wallet shows)',
    decimalsLabel: 'Token decimals, if you know them (optional)',
    answerTitle: 'What this request says',
    contentsTitle: 'What the request contains, as written',
    flagUndeclared: "not declared in the request's types",
    flagUnread: 'we could not read this',
    flagBare: 'number written without quotes',
  },

  refusal: {
    empty: 'Nothing has been pasted yet.',
    'possible-secret-words':
      'This text is a list of ten or more words with no braces. We did not read it, and we have cleared the box. If these words are a recovery phrase, do not paste them anywhere, this page included.',
    'not-json': 'This text is not valid JSON, the format we read signing requests in.',
    truncated: 'Some brackets in this text are never closed. The text may be incomplete; try copying the whole request again.',
    'trailing-text':
      'There is more text after the first complete piece of JSON. If two requests were copied together, paste them one at a time.',
    'unexpected-shape': 'We did not find the parts we look for in a signing request.',
    'unexpected-shape-part': 'The part we did not find, or could not read: "{part}".',
    'main-type-not-found':
      'The request names "{type}" as its primary type, and we did not find a description of that type in it.',
    'too-deep': 'This request is nested deeper than we can read.',
  },

  notChecked: {
    'whose-addresses': 'Who is behind any address in this request. We do not look anything up.',
    'token-genuine': 'Whether the token at this address is the one you expect.',
    'contract-code':
      "The code at the contract's address. We have not read it. Where we explain a field, we repeat what the protocol's own published source says.",
    'address-checksum':
      'The mix of capital and lowercase letters in addresses. By ERC-55 it works as a checksum against typing mistakes. We do not check it.',
    'meaning-of-fields': 'What the fields of this request mean. We show them as they are written.',
    'contract-not-established': 'Which contract this signature is for. We could not establish that from the request.',
    'published-lists-incomplete':
      'Our list of what protocol authors have published is not complete. An address that is missing from it says nothing about the contract.',
    'network-not-compared':
      "The network. We compared the contract's address with the address the protocol's authors publish, and did not check that it is their contract on the network with chain ID {chainId}.",
    'prior-approval-of-permit2':
      "Whether you have approved Permit2 to spend this token before. Permit2's source says its allowances require that approval; the request does not show whether you gave it.",
    'explained-by-single-permit':
      "The batch as a whole. We explain each entry by what Permit2's source says about a single permit; we found nothing in it about batches specifically.",
    'prior-approval-not-found':
      "Whether this kind of signature needs Permit2 to have been approved to spend the token beforehand. We did not find that in Permit2's source.",
    'contract-code-not-compared':
      "Whether the contract at this address runs the code we read. We read a copy of DAI's source that says it was altered from the production version.",
    'other-order-fields':
      'The other fields of the order: zone, orderType, zoneHash, salt, conduitKey and counter. We show them and do not explain them.',
    'token-follows-standard':
      'Whether this token does what the ERC-2612 standard describes. A request of this form can be addressed to any contract, whether or not it is a token.',
    'token-decimals':
      'How many decimal places the token uses (its decimals). That is a property of the token and is not in the request, so we cannot turn the amount into a number of whole tokens without guessing.',
    'device-clock': "The current time. \"In …\", \"… ago\" and \"This moment has passed\" are counted from your device's clock; the contract compares with the network's time.",
    'undeclared-keys':
      "The request has fields that its own type description does not mention: {names}. EIP-712's encoding covers only the described fields. We do not know what your wallet does with the others.",
    'unread-values': 'We could not read some values: {names}. They are shown as written.',
    'bare-large-numbers':
      'Some large numbers are written without quotes: {names}. Parsed in the usual way, such a number loses precision. We show the digits as written. We have not checked what your wallet would sign.',
  },

  form: {
    'erc2612-permit': 'an ERC-2612 permit',
    'dai-permit': 'a permit of the kind DAI uses',
    'permit2-permit-single': 'a Permit2 PermitSingle request',
    'permit2-permit-batch': 'a Permit2 PermitBatch request',
    'permit2-permit-transfer-from': 'a Permit2 PermitTransferFrom request',
    'seaport-order': 'a Seaport order',
  },

  domain: {
    explained: 'The domain is the part of a request that says which contract it is for.',
    permit2:
      'The domain of this request matches the one Permit2\'s authors publish: the name "Permit2" and the contract address {address}. That tells you where the request is addressed. It does not tell you whether to sign it.',
    seaport:
      'The domain of this request matches the one published for Seaport {version}: the name "Seaport", that version, and the contract address {address}. That tells you where the request is addressed. It does not tell you whether to sign it.',
    dai: 'The domain of this request matches the one published for the DAI token: its name, its version, and the contract address {address}. That tells you where the request is addressed. It does not tell you whether to sign it.',
    'domain-not-listed':
      "By its form this is {form}, but its domain does not match any of those we have from the protocol's authors. We do not know what will be done with the signature, so we do not explain the fields; they are shown as written. We do not know why it does not match.",
    'domain-not-declared':
      'By its form this is {form}, but the request does not declare the type of its domain, so we cannot tell which contract the signature would be tied to. The fields are shown as written.',
    'domain-not-standard':
      "By its form this is {form}, but its domain is not built the way the EIP-712 standard allows, so we do not take the token's address from it. The fields are shown as written.",
    unexplained:
      'We have no explanation for the type "{type}". Below is what the request contains. We do not explain what its fields mean.',
    contract: 'The request is addressed to the contract at {address}.',
    noContract: 'The domain of this request names no contract, so the request does not show which contract it is for.',
    network: 'Chain ID {chainId}.',
    networkNamed: 'Chain ID {chainId}: {name}, as named in EIP-155.',
  },

  erc2612: {
    what: 'This is a request of the form the ERC-2612 standard describes. By the standard, a valid signature, once submitted to the token, sets an allowance: the address {spender} can spend tokens held by the address {owner}, up to the amount below.',
    token: "In the standard's usual domain, the token is the contract the request is addressed to: {token}.",
    tokenMissing: 'The request does not show which token this is: its domain names no contract.',
    deadline: 'Signature deadline, the last moment the signature can be submitted: {time}',
  },

  dai: {
    what: 'This request has no amount. It has a yes-or-no field instead.',
    yes: 'The answer is yes: once submitted, the signature lets the address {spender} spend the DAI held by the address {holder}, with no limit on the amount.',
    no: 'The answer is no: once submitted, the signature removes the permission of the address {spender} to spend the DAI held by the address {holder}.',
    expiry: 'Signature deadline, the last moment the signature can be submitted: {time}',
    unread:
      'We could not read the yes-or-no answer in this request, so we do not say which it is. It is shown as written: {value}',
    expiryZero:
      'The expiry is zero. This contract does not check the time when the expiry is zero, so the signature has no deadline.',
  },

  permit2: {
    single: 'A valid signature, once submitted to Permit2, lets the address {spender} spend the token at {token}, up to the amount below.',
    batch: 'A valid signature, once submitted to Permit2, lets the address {spender} spend each of the tokens listed below, each up to its own amount and with its own expiration.',
    batchToken: 'The token at {token}:',
    owner: 'The request does not name whose tokens these are. They are the tokens of whoever signs.',
    twoTimes:
      'This request has two separate times, and they mean different things: until when the signature can be submitted, and until when the allowance it creates can be spent.',
    expiration: 'Allowance expires: {time}',
    expirationZero:
      'The expiration of the allowance is zero. In Permit2 that does not mean "no expiration": the allowance lasts until the end of the block in which the signature is submitted, and within that block it can be spent up to the full amount.',
    sigDeadline: 'Signature deadline, the last moment the signature can be submitted: {time}',
    unlimited: "The amount below is the largest number this field can hold. Permit2's source calls that an unlimited approval.",
    unlimitedInBatch: "At least one amount below is the largest number its field can hold. Under each such amount, a line says so. Permit2's source calls an amount of that size an unlimited approval.",
    transfer: 'A valid signature, once submitted to Permit2, lets the address {spender} transfer the token at {token} from whoever signs, one time, up to the amount below. "One time" means the signature works for one transfer. It says nothing about the size of the transfer; the amount below is its limit.',
    transferRecipient: "The request does not say who receives the tokens. The recipient is named by whoever submits the signature. Permit2's source says the submitter has to be {spender}.",
    transferDeadline: 'Signature deadline, the last moment the signature can be submitted: {time}',
  },

  seaport: {
    what: 'This request has the form of a Seaport order. An order is two lists: what may leave the account of whoever placed it, and what must be received in return.',
    recipient: 'Received by the address {address}.',
    offer: 'Items that may be transferred from the account of whoever placed the order:',
    offerRecipient: 'The order does not say who receives these items.',
    consideration: 'Items that must be received for the order to be carried out, each listed with the address that receives it:',
    extended: 'Whoever carries out the order may add entries of their own to the list of items that must be received.',
    native: "the network's own coin",
    erc20: 'the ERC-20 token at {token}',
    erc721: 'token ID {id} in the ERC-721 collection at {token}',
    erc1155: 'token ID {id} in the ERC-1155 collection at {token}',
    'erc721-criteria': 'an item of the ERC-721 collection at {token}, selected by a criterion rather than by ID',
    'erc1155-criteria': 'an item of the ERC-1155 collection at {token}, selected by a criterion rather than by ID',
    anyItem: 'The criterion is zero, which means any item of this collection.',
    amountChanges: 'The amount changes over time: {start} when the order begins, {end} when it ends.',
    starts: 'Order starts: {time}',
    ends: 'Order ends: {time}',
  },

  amount: {
    exact: "Exact value in the request, in the token's smallest units: {exact}",
    count: 'Exact number in the request: {exact}',
    decimalsUnknown: 'We do not know how many decimals this token has. Two examples of what the amount would be:',
    assumed: 'If the token has {decimals} decimals: {amount}. That is an assumption, not a fact.',
    stated: 'With the number of decimals you entered ({decimals}): {amount}. The result is only as accurate as that number.',
    largest: 'This is the largest number this field can hold. Nothing larger fits in it.',
    largestUnexplained: 'We do not know what this token does with such an amount.',
    unread: 'We could not read this value as a number. It is shown as written: {value}',
  },

  time: {
    date: '{date} {zone}',
    passed: 'This moment has passed.',
    largest: 'This is the largest number this field can hold. Nothing later fits in it.',
    beyondDates: 'This moment is too far ahead for us to show as a date.',
    zero: 'The value is zero. As a date, zero is 1 January 1970.',
  },
};
