import { describe, expect, it } from "vitest";
import { AGENT_APP_ORIGIN, isAllowedAgentMutationOrigin } from "./request-security";

describe("Agent gateway origin boundary", () => {
  it("fails closed for missing, opaque, and mismatched origins", () => {
    expect(isAllowedAgentMutationOrigin(undefined)).toBe(false);
    expect(isAllowedAgentMutationOrigin("null")).toBe(false);
    expect(isAllowedAgentMutationOrigin("https://example.com")).toBe(false);
    expect(isAllowedAgentMutationOrigin(AGENT_APP_ORIGIN)).toBe(true);
  });
});
