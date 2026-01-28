import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("should merge tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("should handle conditional classes", () => {
    expect(cn("p-4", true && "m-2", false && "bg-red-500")).toBe("p-4 m-2");
  });
});
