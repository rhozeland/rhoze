import { describe, it, expect } from "vitest";
import { tokenPairingError } from "./token-pairing";
describe("optional existing-token pairing", () => {
  it("allows a project without a token", () => expect(tokenPairingError("")).toBe(""));
  it("accepts an existing Solana contract address", () => expect(tokenPairingError("7khGn21aGKKAPi1ZF5EsdECdtyDcnYHtMKELrZDpump")).toBe(""));
  it("rejects malformed contract addresses", () => expect(tokenPairingError("not-a-contract")).not.toBe(""));
});