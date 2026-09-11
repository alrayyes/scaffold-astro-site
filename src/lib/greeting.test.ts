import { describe, expect, it } from "bun:test";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it("greets a given name", () => {
    expect(getGreeting("Ada")).toBe("Hello, Ada!");
  });

  it("trims surrounding whitespace", () => {
    expect(getGreeting("  Ada  ")).toBe("Hello, Ada!");
  });

  it("falls back to a generic greeting with no name", () => {
    expect(getGreeting()).toBe("Hello, world!");
  });

  it("falls back to a generic greeting for a blank name", () => {
    expect(getGreeting("   ")).toBe("Hello, world!");
  });
});
