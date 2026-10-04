// Recognition of the request types this project explains, and for each one,
// which member answers which question: who receives the right, over which
// token, how much, until when. No wording for people lives here.
//
// A type is recognised by its full declaration, not by its name alone. The
// name is whatever the requesting site chose to write: ERC-2612 and DAI both
// call their type "Permit" and mean different things by it, and nothing stops
// a request from naming an unrelated struct "Permit" too. So the declaration
// in the request is written out the way EIP-712 itself writes a type before
// hashing it (`encodeType`), and compared with the string the protocol's own
// code hashes. A request that differs in one member is not the known type,
// and is treated as unfamiliar.
//
// Every string and every role below was read from the source named next to
// it, at the commit in the link, on 2026-10-04.

// Domains of the contracts these protocols are deployed as: the declaration
// of EIP712Domain each contract hashes, and the values it hashes with it.
// The chain id is part of every declaration but is not listed among the
// values: it differs from network to network and there is nothing to compare
// it with. DAI is the exception, because the address below is its address on
// one particular network.
//
// A domain here means only that the protocol's authors publish it. The lists
// are not claimed to be complete (Seaport had versions before 1.5), and apart
// from DAI they are not tied to a network: an address published for one
// network is accepted on any.

// Permit2. Declaration and name: EIP712.sol hashes
// "EIP712Domain(string name,uint256 chainId,address verifyingContract)" and
// "Permit2"; there is no version. Addresses: Uniswap's SDK gives one for
// network 324 and another for every other network.
// https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/EIP712.sol
// https://github.com/Uniswap/sdks/blob/17d70b1b1068fc1b5ce79a89fb5901e562a22e79/sdks/permit2-sdk/src/constants.ts
const PERMIT2 = [
  '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  '0x0000000000225e31D15943971F47aD3022F714Fa',
].map((verifyingContract) => ({
  declaration: 'EIP712Domain(string name,uint256 chainId,address verifyingContract)',
  values: { name: 'Permit2', verifyingContract },
}));

const NAME_VERSION_CHAIN_CONTRACT =
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';

// Seaport 1.6 and 1.5. Declaration and version: ConsiderationBase.sol of each
// version; name: Seaport.sol of each version returns "Seaport"; addresses:
// OpenSea's seaport-js.
// https://github.com/ProjectOpenSea/seaport-core/blob/523097f9cee66c15d308c900c50f336b291cda08/src/lib/ConsiderationBase.sol
// https://github.com/ProjectOpenSea/seaport-core/blob/523097f9cee66c15d308c900c50f336b291cda08/src/Seaport.sol
// https://github.com/ProjectOpenSea/seaport/blob/ab3b5cb6e10580ea979d63983e409e679935c702/contracts/lib/ConsiderationBase.sol
// https://github.com/ProjectOpenSea/seaport/blob/ab3b5cb6e10580ea979d63983e409e679935c702/contracts/Seaport.sol
// https://github.com/ProjectOpenSea/seaport-js/blob/cb6466465401038233bbc9c4917ed22ac9f8bf8b/src/constants.ts
const SEAPORT = [
  ['1.6', '0x0000000000000068F116a894984e2DB1123eB395'],
  ['1.5', '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC'],
].map(([version, verifyingContract]) => ({
  declaration: NAME_VERSION_CHAIN_CONTRACT,
  values: { name: 'Seaport', version, verifyingContract },
}));

// DAI. Declaration, name and version: dai.sol. Address: MCD_DAI in Maker's
// own record of its first mainnet release. That makes it an address on
// Ethereum mainnet, which EIP-155 numbers 1 ("1 | Ethereum mainnet").
// https://github.com/makerdao/dss/blob/fa4f6630afb0624d04a003e920b0d71a00331d98/src/dai.sol
// https://github.com/makerdao/mcd-changelog/blob/d73dfd17d54ad1bb00d8087bce25dd2866e3f397/releases/mainnet/1.0.0/contracts.json
// https://github.com/ethereum/EIPs/blob/3b3c832577ec4205d463d990d52006e299962449/EIPS/eip-155.md
const DAI = [
  {
    declaration: NAME_VERSION_CHAIN_CONTRACT,
    values: {
      name: 'Dai Stablecoin',
      version: '1',
      chainId: '1',
      verifyingContract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    },
  },
];

const KNOWN = [
  {
    // Two separate quotes from "Specification": "a call to permit(owner,
    // spender, value, deadline, v, r, s) will set allowance[owner][spender] to
    // value", and among the conditions for that, "The current blocktime is
    // less than or equal to deadline". So the deadline limits when the
    // signature can be used; the standard gives the allowance itself no
    // expiry. The token is not in the message: the standard puts it in the
    // domain, as "verifyingContract": tokenAddress.
    // https://github.com/ethereum/ERCs/blob/365b4c02879f3e882b91281d42b4f57b406205e9/ERCS/erc-2612.md
    kind: 'erc2612-permit',
    encodeType: 'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
    roles: {
      spender: 'message.spender',
      token: 'domain.verifyingContract',
      amount: 'message.value',
      signatureDeadline: 'message.deadline',
    },
  },
  {
    // There is no amount. `allowed` is a yes or no:
    // `uint wad = allowed ? uint(-1) : 0; allowance[holder][spender] = wad;`
    // and an allowance of that size is not reduced by spending (transferFrom
    // subtracts only when `allowance[src][msg.sender] != uint(-1)`).
    // `expiry` limits when the signature can be used, with zero switching
    // the check off: `require(expiry == 0 || now <= expiry)`. The domain is
    // built with `address(this)`, so here too the token is verifyingContract.
    // The file says of itself that it "was altered compared to the production
    // version" (it no longer uses LibNote); the type string and the permit
    // function are what was read from it.
    // https://github.com/makerdao/dss/blob/fa4f6630afb0624d04a003e920b0d71a00331d98/src/dai.sol
    domains: DAI,
    kind: 'dai-permit',
    encodeType: 'Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)',
    roles: {
      spender: 'message.spender',
      token: 'domain.verifyingContract',
      allowed: 'message.allowed',
      signatureDeadline: 'message.expiry',
    },
  },
  {
    // Two different times. `sigDeadline` is how long the signature can be
    // submitted: AllowanceTransfer.sol has `if (block.timestamp >
    // permitSingle.sigDeadline) revert SignatureExpired(permitSingle.sigDeadline);`.
    // `expiration` is how long the allowance lasts: IAllowanceTransfer.sol
    // describes the stored value as the "expiration at which the allowed
    // amount is no longer valid". The type strings are in PermitHash.sol.
    //
    // The largest amount the type can hold has a meaning of its own.
    // IAllowanceTransfer.sol: "Setting amount to type(uint160).max sets an
    // unlimited approval"; AllowanceTransfer.sol reduces the allowance on a
    // transfer only `if (maxAmount != type(uint160).max)`.
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/libraries/PermitHash.sol
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/interfaces/IAllowanceTransfer.sol
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/AllowanceTransfer.sol
    domains: PERMIT2,
    kind: 'permit2-permit-single',
    encodeType:
      'PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)',
    roles: {
      spender: 'message.spender',
      token: 'message.details.token',
      amount: 'message.details.amount',
      allowanceExpiration: 'message.details.expiration',
      signatureDeadline: 'message.sigDeadline',
    },
  },
  {
    // The same as PermitSingle with a list of tokens and one spender for all.
    // Same sources.
    domains: PERMIT2,
    kind: 'permit2-permit-batch',
    encodeType:
      'PermitBatch(PermitDetails[] details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)',
    roles: {
      spender: 'message.spender',
      token: 'message.details[].token',
      amount: 'message.details[].amount',
      allowanceExpiration: 'message.details[].expiration',
      signatureDeadline: 'message.sigDeadline',
    },
  },
  {
    // ISignatureTransfer.sol: `amount` is "the maximum amount that can be
    // spent", `deadline` is the "deadline on the permit signature". The
    // contract's struct has no spender ("it is required that it is
    // msg.sender"), but the signed message does: "a user still signs over a
    // spender address".
    //
    // The signature works once. README.md: "permissions to the spender only
    // last for the duration of the transaction that the one-time signature is
    // spent"; SignatureTransfer.sol marks the nonce as used and reverts with
    // InvalidNonce on a second attempt.
    //
    // Who receives the tokens is not in the signed message. PermitHash.sol
    // hashes the token, the amount, the spender, the nonce and the deadline;
    // the recipient is `transferDetails.to`, which ISignatureTransfer.sol
    // calls "the spender's requested transfer details" and which the spender
    // supplies when it uses the signature. So there is no role for it here.
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/libraries/PermitHash.sol
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/interfaces/ISignatureTransfer.sol
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/SignatureTransfer.sol
    // https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/README.md
    domains: PERMIT2,
    kind: 'permit2-permit-transfer-from',
    encodeType:
      'PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)',
    roles: {
      spender: 'message.spender',
      token: 'message.permitted.token',
      amount: 'message.permitted.amount',
      signatureDeadline: 'message.deadline',
    },
  },
  {
    // "The offer contains an array of items that may be transferred from the
    // offerer's account"; "The consideration contains an array of items that
    // must be received in order to fulfill the order", each with "a recipient
    // that will receive" it. startTime is when "the order becomes active",
    // endTime when it "expires". The contract hashes the three type strings
    // joined in this order: OrderComponents, ConsiderationItem, OfferItem.
    // https://github.com/ProjectOpenSea/seaport-core/blob/523097f9cee66c15d308c900c50f336b291cda08/src/lib/ConsiderationBase.sol
    // https://github.com/ProjectOpenSea/seaport/blob/7f966fe7bd75932beb0366f6485aa720512b1259/docs/SeaportDocumentation.md
    // Seaport 1.5 declares the same types: its three type strings, at the
    // commit the repository's tag `1.5` points to, join into the string below.
    // https://github.com/ProjectOpenSea/seaport/blob/ab3b5cb6e10580ea979d63983e409e679935c702/contracts/lib/ConsiderationBase.sol
    domains: SEAPORT,
    kind: 'seaport-order',
    encodeType:
      'OrderComponents(address offerer,address zone,OfferItem[] offer,ConsiderationItem[] consideration,uint8 orderType,uint256 startTime,uint256 endTime,bytes32 zoneHash,uint256 salt,bytes32 conduitKey,uint256 counter)ConsiderationItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount,address recipient)OfferItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount)',
    roles: {
      offerer: 'message.offerer',
      offer: 'message.offer[]',
      consideration: 'message.consideration[]',
      startTime: 'message.startTime',
      endTime: 'message.endTime',
    },
  },
];

// Takes a successful result of parseRequest (ok: true) and returns null for a
// type that is not in the table, and otherwise one of:
//
//   { kind, roles }       the roles can be read as the table describes them;
//   { kind, unverified }  the message has this shape, and that is all we know.
//
// A role is a path into the parse result: `domain` or `message`, then
// member names; `[]` means every item of a list.
//
// The types say what shape the message has, not which contract will receive
// the signature: any contract can ask for a signature over these same types
// and do something else with it. A signature is tied to a contract by the
// domain, and a contract accepts it only if the whole domain is the one it
// hashes itself: the declaration, the name, the version, the address. So that
// is what is compared, not the address alone. EIP-712 calls verifyingContract
// "the address of the contract that will verify the signature".
//
// `unverified` says why the comparison did not succeed:
//
//   'domain-not-declared'  the request has no EIP712Domain among its types.
//       What a wallet would sign as the domain is then unknown, and so is
//       whether the address in the request would be part of it. The first
//       version took the address as written in this case; that let a request
//       be named after a protocol on the strength of a field nothing binds.
//   'domain-not-listed'    the domain is declared and is not one of those
//       published for this protocol.
//
// The rule is one-sided. A listed domain lets us name the protocol; a domain
// that is not listed is not a finding about that contract.
//
// An ERC-2612 permit has no list: the contract is the token itself, and it
// can be any token. Its roles are always returned, and they describe what the
// standard says such a message means; whether that token follows the standard
// is not something this code can check. DAI's permit is listed, because DAI
// is one contract; the same shape sent to any other token is 'domain-not-listed'.
export function recognise({ primaryType, types, domain }) {
  const declared = encodeType(primaryType, types);
  const known = KNOWN.find((entry) => entry.encodeType === declared);
  if (!known) return null;

  const { kind, roles, domains } = known;
  if (!domains) return { kind, roles };
  if (!Object.hasOwn(types, 'EIP712Domain')) return { kind, unverified: 'domain-not-declared' };

  const declaration = encodeType('EIP712Domain', types);
  const valueOf = (name) => domain.find((field) => field.name === name && !field.undeclared)?.value;
  const listed = domains.some(
    (published) =>
      published.declaration === declaration &&
      Object.entries(published.values).every(([name, value]) => same(name, valueOf(name), value)),
  );
  return listed ? { kind, roles } : { kind, unverified: 'domain-not-listed' };
}

// An address is a number written in hexadecimal: the case of its letters does
// not change which address it is. Every other value is compared as written.
function same(name, actual, published) {
  if (typeof actual !== 'string') return false;
  return name === 'verifyingContract'
    ? actual.toLowerCase() === published.toLowerCase()
    : actual === published;
}

// EIP-712, "Definition of encodeType": the type is written as its name and
// its members, each as `type name`; "the set of referenced struct types is
// collected, sorted by name and appended to the encoding".
// https://github.com/ethereum/EIPs/blob/3b3c832577ec4205d463d990d52006e299962449/EIPS/eip-712.md
function encodeType(primaryType, types) {
  const referenced = new Set();
  const pending = [primaryType];
  while (pending.length > 0) {
    for (const { type } of types[pending.pop()]) {
      // `Person[]` and `Person[2][]` both refer to the struct `Person`.
      const bracket = type.indexOf('[');
      const struct = bracket === -1 ? type : type.slice(0, bracket);
      if (struct !== primaryType && Object.hasOwn(types, struct) && !referenced.has(struct)) {
        referenced.add(struct);
        pending.push(struct);
      }
    }
  }

  const names = [primaryType, ...[...referenced].sort()];

  // The encoding is only as good as its separators. A member named
  // "owner,address spender,uint256 value" would write out to the very string a
  // real five-member Permit does, so a declaration that uses a separator
  // inside a name or a type has no encoding here and matches nothing.
  const pieces = names.flatMap((name) => [name, ...types[name].flatMap((m) => [m.type, m.name])]);
  if (pieces.some((piece) => /[(), ]/.test(piece))) return null;

  return names
    .map((name) => `${name}(${types[name].map((member) => `${member.type} ${member.name}`).join(',')})`)
    .join('');
}
