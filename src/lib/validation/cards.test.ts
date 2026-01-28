import { describe, it, expect } from "vitest";
import { CreateManualCardSchema, ListCardsQuerySchema } from "./cards";

describe("Cards Validation Schemas", () => {
  describe("CreateManualCardSchema", () => {
    it("should validate a correct card", () => {
      const validCard = {
        front: "Kasia ma kota",
        back: "Kasia has a cat",
      };
      const result = CreateManualCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
    });

    it("should fail if front is empty", () => {
      const invalidCard = {
        front: "",
        back: "Back",
      };
      const result = CreateManualCardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Treść awersu jest wymagana");
      }
    });

    it("should fail if front is too long", () => {
      const invalidCard = {
        front: "a".repeat(201),
        back: "Back",
      };
      const result = CreateManualCardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Treść awersu nie może przekraczać 200 znaków");
      }
    });

    it("should fail if back is empty", () => {
      const invalidCard = {
        front: "Front",
        back: "",
      };
      const result = CreateManualCardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Treść rewersu jest wymagana");
      }
    });
  });

  describe("ListCardsQuerySchema", () => {
    it("should use defaults for empty object", () => {
      const result = ListCardsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          page: 1,
          pageSize: 20,
          sort: "createdAt:desc",
        });
      }
    });

    it("should coerce string numbers to numeric values", () => {
      const result = ListCardsQuerySchema.safeParse({
        page: "2",
        pageSize: "30",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(30);
      }
    });

    it("should fail if pageSize is below 20", () => {
      const result = ListCardsQuerySchema.safeParse({
        pageSize: 10,
      });
      expect(result.success).toBe(false);
    });

    it("should transform empty string query to undefined", () => {
      const result = ListCardsQuerySchema.safeParse({
        q: "   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBeUndefined();
      }
    });
  });
});
