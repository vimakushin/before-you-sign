// The two requests behind the "Example" buttons: the complete Permit2 request
// from test/fixtures/permit2-permit-single.json, put together by the project
// from Permit2's published types. Not a capture of anything a wallet showed.
//
// Two things differ from the fixture, and a test (test/example.test.js) holds
// everything else equal to it. The two times are counted from the moment of
// the call: the fixture's own deadline is a fixed date, and by now it has
// passed, so the first thing the page said about the example would be "this
// moment has passed", which is not what the example is there to show. And the
// second example has a smaller amount, so that the field for the token's
// decimals appears.

const AMOUNTS = {
  largest: '1461501637330902918203684832716283019655932542975',
  particular: '2500000',
};

export function example(kind, now) {
  const seconds = Math.floor(now);
  return JSON.stringify(
    {
      domain: {
        chainId: '1',
        name: 'Permit2',
        verifyingContract: '0x000000000022d473030f116ddee9f6b43ac78ba3',
      },
      message: {
        details: {
          amount: AMOUNTS[kind],
          expiration: String(seconds + 30 * 24 * 3600),
          nonce: '0',
          token: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        },
        sigDeadline: String(seconds + 30 * 60),
        spender: '0x23617e59a5925b2a4bf75d73ff6711cd0b29de85',
      },
      primaryType: 'PermitSingle',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        PermitSingle: [
          { name: 'details', type: 'PermitDetails' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
      },
    },
    null,
    2,
  );
}
