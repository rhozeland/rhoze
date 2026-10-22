import { describe, it, expect } from "vitest";
import { coinLaunchRequested, FEE_LABEL } from "./project-flow";
describe("coin launch request", () => {
  it("shows requested until the team adds a mint", () => {
    expect(coinLaunchRequested({ coin_mint: "", answers: { coin_choice: "rhozeland" } })).toBe(true);
    expect(coinLaunchRequested({ coin_mint: "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump", answers: { coin_choice: "rhozeland" } })).toBe(false);
    expect(coinLaunchRequested({ coin_mint: "", answers: { coin_choice: "skip" } })).toBe(false);
  });
  it("labels the fee line", () => expect(FEE_LABEL).toBe("Rhozeland fee (includes coin launch)"));
});
