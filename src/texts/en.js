// Everything the page says to a person, in English. English is the reference
// version; ru.js mirrors it key for key.
//
// Each sentence states something the project is entitled to state: what is
// visible in the request, what follows from it by arithmetic, or what a
// protocol's own source says (the sources are quoted in known-types.js and
// values.js). Nothing here says whether to sign, and nothing calls anyone a
// fraud. Words in {braces} are filled in by the page.
//
// Addresses, amounts and times are never put inside a sentence. Each stands
// on a line of its own under a label ("Signature deadline", "Allowance
// expires"), so that whatever the request holds there still reads: a date, a
// date already past, or a number that is the largest its field can hold.

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
    detailsTitle: 'Details',
    mechanicsTitle: 'How this request works',
    unreadNote: 'We could not read this value. It is shown as written.',
    contentsTitle: 'What the request contains, as written',
    flagUndeclared: "not declared in the request's types",
    flagUnread: 'we could not read this',
    flagBare: 'number written without quotes',
    pasted: 'Characters in the box: {count}',
    decimalsRejected: 'We did not use this value. Enter a whole number from 0 to 255.',
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
    'unexpected-shape-part': 'The part we did not find, or could not read: {part}.',
    'main-type-not-found':
      'The request names "{type}" as its primary type, and we did not find a description of that type in it.',
    'too-deep': 'This request is nested deeper than we can read.',
  },

  // The parts of a signing request, named for a person rather than by the
  // word the format uses for them.
  part: {
    types: 'the description of the kinds of data in the request',
    primaryType: 'the name of the main kind of data',
    domain: 'the description of where the request is addressed',
    message: 'the contents of the request itself',
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
    'network-not-compared': "Whether this is the protocol's own contract on the network with chain ID {chainId}. We compared the address with the one the protocol's authors publish. A matching address alone does not show that the contract on this network is theirs.",
    'prior-approval-of-permit2':
      "Whether you have approved Permit2 to spend this token before. Permit2's source code says its allowances require that approval; the request does not show whether you gave it.",
    'explained-by-single-permit':
      "The batch as a whole. We explain each entry by what Permit2's source code says about a single permit; we found nothing in it about batches specifically.",
    'prior-approval-not-found':
      "Whether this kind of signature needs Permit2 to have been approved to spend the token beforehand. We did not find that in Permit2's source code.",
    'contract-code-not-compared':
      "Whether the contract at this address runs the code we read. We read a copy of DAI's source code that says it was altered from the production version.",
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

  // The one sentence at the top of an answer. It has no address and no number
  // in it: those are listed under it, each on a line of its own.
  main: {
    allowance: 'Once submitted, this signature lets the address named in it spend a token of yours, up to the amount written in the request.',
    allowanceUnlimited: 'Once submitted, this signature lets the address named in it spend a token of yours, with no limit on the amount.',
    batch: 'Once submitted, this signature lets the address named in it spend the tokens of yours listed below, each up to its own amount.',
    batchUnlimited: 'Once submitted, this signature lets the address named in it spend the tokens of yours listed below, at least one of them with no limit on the amount.',
    transfer: 'Once submitted, this signature lets the address named in it make one transfer of a token of yours, up to the amount written in the request.',
    erc2612: 'By the ERC-2612 standard, this signature, once submitted, lets one address spend tokens held by a second address, up to the amount written in the request.',
    daiYes: 'Once submitted, this signature lets one address spend the DAI held by a second address, with no limit on the amount.',
    daiNo: 'Once submitted, this signature removes the permission of one address to spend the DAI held by a second address.',
    daiUnread: 'This request contains a yes-or-no answer that we could not read, so we do not say what the signature does.',
    seaport: 'This request has the form of a Seaport order: what may leave the account that placed it, and what must be received for it to be carried out.',
  },

  // What an address in the request is, written above the address.
  label: {
    spender: 'Address that may spend',
    transferSpender: 'Address that may make the transfer',
    holder: 'Address whose tokens may be spent',
    token: 'Token, by the address of its contract',
  },

  domain: {
    explained: 'The domain is the part of a request that says which contract it is for.',
    contractLabel: 'Contract the request is addressed to',
    permit2:
      'The domain of this request matches the one Permit2\'s authors publish: the name "Permit2" and the contract address shown below. That tells you where the request is addressed. It does not tell you whether to sign it.',
    seaport:
      'The domain of this request matches the one published for Seaport {version}: the name "Seaport", that version, and the contract address shown below. That tells you where the request is addressed. It does not tell you whether to sign it.',
    dai: 'The domain of this request matches the one published for the DAI token: its name, its version, and the contract address shown below. That tells you where the request is addressed. It does not tell you whether to sign it.',
    formOnly: 'By its form this is {form}. We do not explain its fields; they are shown as written.',
    'domain-not-listed':
      "The domain of this request does not match any of those we have from the protocol's authors, so we do not know what will be done with the signature. We do not know why it does not match.",
    'domain-not-declared':
      'The request does not declare the type of its domain, so we cannot tell which contract the signature would be tied to.',
    'domain-not-standard':
      "The domain of this request is not built the way the EIP-712 standard allows, so we do not take the token's address from it.",
    typeLabel: 'Type named in the request',
    unexplained: 'We have no explanation for the type of this request.',
    unexplainedMore: 'Below is what the request contains. We do not explain what its fields mean.',
    noContract: 'The domain of this request names no contract, so the request does not show which contract it is for.',
    network: 'Chain ID {chainId}.',
    networkNamed: 'Chain ID {chainId}: {name}, as named in EIP-155.',
  },

  erc2612: {
    what: 'This is a request of the form the ERC-2612 standard describes. By the standard, a valid signature, once submitted to the token, sets an allowance: the address labelled "{spender}" can spend tokens held by the address labelled "{holder}", up to the amount.',
    token: 'Token: the contract the request is addressed to (the usual arrangement under this standard)',
    tokenMissing: 'The request does not show which token this is: its domain names no contract.',
    rejectsLate: "By the ERC-2612 standard, the token must reject a signature submitted after its deadline. The comparison is with the network's time, not with your device's clock.",
  },

  dai: {
    what: 'This request has no amount. It has a yes-or-no field instead.',
    answerLabel: 'The yes-or-no answer in the request',
    yesWord: 'yes',
    noWord: 'no',
    yes: 'The answer is yes: once submitted, the signature lets the address labelled "{spender}" spend the DAI held by the address labelled "{holder}", with no limit on the amount.',
    no: 'The answer is no: once submitted, the signature removes the permission of the address labelled "{spender}" to spend the DAI held by the address labelled "{holder}".',
    unread: 'We could not read the yes-or-no answer in this request, so we do not say which it is.',
    expiryZero:
      'The expiry is zero. This contract does not check the time when the expiry is zero, so the signature has no deadline.',
    rejectsLate: "DAI's source code rejects a signature submitted after its deadline. The contract compares the deadline with the network's time, not with your device's clock.",
  },

  permit2: {
    single: 'A valid signature, once submitted to Permit2, lets the address labelled "{spender}" spend the token, up to the amount.',
    batch: 'A valid signature, once submitted to Permit2, lets the address labelled "{spender}" spend each of the listed tokens, each up to its own amount and with its own expiration.',
    batchToken: 'Token {n}, by the address of its contract',
    owner: 'The request does not name whose tokens these are. They are the tokens of whoever signs.',
    twoTimes:
      'This request has two separate times, and they mean different things: until when the signature can be submitted, and until when the allowance it creates can be spent.',
    expiration: 'Allowance expiration: the last moment the allowance can be spent',
    expirationPassed: "By your device's clock, the expiration of the allowance in this request has already passed.",
    expirationZero:
      'The expiration of the allowance is zero. In Permit2 that does not mean "no expiration": the allowance lasts until the end of the block in which the signature is submitted, and within that block it can be spent up to the full amount.',
    unlimited: "This is the largest number this field can hold. Permit2's source code calls that an unlimited approval.",
    transfer: 'A valid signature, once submitted to Permit2, lets the address labelled "{spender}" transfer the token from whoever signs, one time, up to the amount. "One time" means the signature works for one transfer. It says nothing about the size of the transfer; the amount is its limit.',
    transferRecipient: "The request does not say who receives the tokens. The recipient is named by whoever submits the signature. Permit2's source code says the submitter has to be the address labelled \"{spender}\".",
    rejectsLate: "Permit2's source code rejects a signature submitted after its deadline. The contract compares the deadline with the network's time, not with your device's clock.",
    unlimitedDecimals: 'With an amount of this size the number of decimals changes nothing, so we do not ask for it here.',
  },

  seaport: {
    recipient: 'Address that receives this item',
    offer: 'Items that may be transferred from the account of whoever placed the order',
    offerRecipient: 'The order does not say who receives these items.',
    consideration: 'Items that must be received for the order to be carried out, each with the address that receives it',
    extended: 'Whoever carries out the order may add entries of their own to the list of items that must be received.',
    native: "The network's own coin",
    erc20: 'ERC-20 token, by the address of its contract',
    erc721: 'Item of an ERC-721 collection, by the address of the collection',
    erc1155: 'Item of an ERC-1155 collection, by the address of the collection',
    'erc721-criteria': 'Item of an ERC-721 collection, chosen by a criterion instead of an ID: address of the collection',
    'erc1155-criteria': 'Item of an ERC-1155 collection, chosen by a criterion instead of an ID: address of the collection',
    tokenId: 'Token ID',
    anyItem: 'The criterion is zero, which means any item of this collection.',
    amountStart: 'Amount when the order begins (exact value in the request)',
    amountEnd: 'Amount when the order ends (exact value in the request)',
    starts: 'Order starts',
    ends: 'Order ends',
    endPassed: "By your device's clock, the end time of this order has already passed.",
  },

  amount: {
    exact: "Amount, exactly as written in the request (in the token's smallest units)",
    count: 'Exact number in the request',
    decimalsUnknown: 'We do not know how many decimals this token has. Two examples of what the amount would be:',
    assumed: 'If the token has {decimals} decimals: {amount}. That is an assumption, not a fact.',
    stated: 'With the number of decimals you entered ({decimals}): {amount}. The result is only as accurate as that number.',
    largest: 'This is the largest number this field can hold. Nothing larger fits in it.',
    largestNotable: 'The amount in this request is the largest number its field can hold.',
    severalTokens:
      'This request involves more than one token. The number of decimals is set by each token, is not in the request, and may differ from one token to the next. So we do not apply a single number to all the amounts, and there is no field for one here.',
    largestUnexplained: 'We do not know what this token does with such an amount.',
    largestDecimals: "We do not ask for the token's decimals here: the amount is the largest number the field can hold, however many decimals the token has.",
  },

  time: {
    signatureDeadline: 'Signature deadline: the last moment the signature can be submitted',
    signatureDeadlinePassed: "By your device's clock, the signature deadline in this request has already passed.",
    date: '{date} {zone}',
    passed: 'This moment has passed.',
    largest: 'This is the largest number this field can hold. Nothing later fits in it.',
    beyondDates: 'This moment is too far ahead for us to show as a date.',
    zero: 'The value is zero. As a date, zero is 1 January 1970.',
  },
};
