import { describe, it, expect } from "vitest";
import { tokenPairingError } from "./token-pairing";
describe("optional existing-token pairing", () => {
  it("allows a project without a token", () => expect(tokenPairingError("")).toBe(""));
  it("accepts an existing Solana contract address", () => expect(tokenPairingError("7khGn21aGKKAPi1ZF5EsdECdtyDcnYHtMKELrZDpump")).toBe(""));
  it("rejects malformed contract addresses", () => expect(tokenPairingError("not-a-contract")).not.toBe(""));
});
import { RHOZE_MINT } from "@/lib/rhozeChain";
describe("official $RHOZE pairing", () => {
  it("accepts the official Rhozeland contract address", () => {
    expect(tokenPairingError(RHOZE_MINT)).toBeFalsy();
  });
});
