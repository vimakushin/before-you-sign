// Type descriptions as their authors publish them, retrieved 2026-10-04.
//
// These are the `types` part of a request only. The sources give no complete
// request with values for these types (ERC-2612 shows one with placeholders
// such as `"owner": owner`), and none was made up to fill the gap.

// The text of ERC-2612, "Specification":
// https://github.com/ethereum/ERCs/blob/365b4c02879f3e882b91281d42b4f57b406205e9/ERCS/erc-2612.md
export const erc2612 = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

// The DAI contract publishes its type only as the string it hashes:
// "Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)".
// The list below is that string split into members by hand, so for this one
// type the test compares the string with itself and proves less than the rest.
// https://github.com/makerdao/dss/blob/fa4f6630afb0624d04a003e920b0d71a00331d98/src/dai.sol
export const dai = {
  Permit: [
    { name: 'holder', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'allowed', type: 'bool' },
  ],
};

// Uniswap's Permit2 SDK, PERMIT_TYPES and PERMIT_BATCH_TYPES:
// https://github.com/Uniswap/sdks/blob/17d70b1b1068fc1b5ce79a89fb5901e562a22e79/sdks/permit2-sdk/src/allowanceTransfer.ts
const PERMIT_DETAILS = [
  { name: 'token', type: 'address' },
  { name: 'amount', type: 'uint160' },
  { name: 'expiration', type: 'uint48' },
  { name: 'nonce', type: 'uint48' },
];

export const permit2PermitSingle = {
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: PERMIT_DETAILS,
};

export const permit2PermitBatch = {
  PermitBatch: [
    { name: 'details', type: 'PermitDetails[]' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: PERMIT_DETAILS,
};

// Uniswap's Permit2 SDK, PERMIT_TRANSFER_FROM_TYPES:
// https://github.com/Uniswap/sdks/blob/17d70b1b1068fc1b5ce79a89fb5901e562a22e79/sdks/permit2-sdk/src/signatureTransfer.ts
export const permit2PermitTransferFrom = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};

// OpenSea's seaport-js, EIP_712_ORDER_TYPE:
// https://github.com/ProjectOpenSea/seaport-js/blob/cb6466465401038233bbc9c4917ed22ac9f8bf8b/src/constants.ts
export const seaportOrder = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' },
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
  ],
};
