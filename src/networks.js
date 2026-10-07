// Names of networks by chain id. Only the networks EIP-155 itself names in its
// "List of Chain ID's" are here, and only those it gives one name to; for any
// other chain id the page shows the number and no name. A fuller list exists
// elsewhere, but none of it has been read, and a wrong network name is worse
// than a number. Retrieved 2026-10-04, at this fixed commit; the page links to
// the same version next to a name, so that a person can read the list the name
// comes from. Opened and read by the owner on 2026-10-08: the document opens,
// its category is Core, its status Final, and it holds the table of chain IDs.
export const EIP_155 = 'https://github.com/ethereum/EIPs/blob/3b3c832577ec4205d463d990d52006e299962449/EIPS/eip-155.md';
const NAMES = {
  1: 'Ethereum mainnet',
  3: 'Ropsten',
  4: 'Rinkeby',
  5: 'Goerli',
  42: 'Kovan',
};

// Takes a chain id as the request writes it (decimal digits) and returns the
// name or null.
export function networkName(chainId) {
  return typeof chainId === 'string' && Object.hasOwn(NAMES, chainId) ? NAMES[chainId] : null;
}
