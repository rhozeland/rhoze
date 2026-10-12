export const TOKEN_PAIRING_NOTICE = "Optional: link an existing Solana token to show its market chart and contract address. This does not create a token, move money, guarantee returns, or grant ownership of the project. Tokens can lose all their value.";
export function tokenPairingError(mint: string) {
  return !mint.trim() || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim()) ? "" : "Enter a valid Solana contract address, or leave it blank.";
}