import { inventoryService } from "../../src/services/inventory.service.js";
import { AppError } from "../../src/middleware/error-handler.js";

jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  default: {
    inventory: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";

const mockPrisma = prisma as any;

describe("InventoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAvailability", () => {
    it("should return available and blocked counts", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 10,
        blocked_count: 2,
      });

      const result = await inventoryService.getAvailability("rt1", "2026-01-15");

      expect(result).toEqual({ available: 10, blocked: 2 });
    });

    it("should return 0,0 when no inventory exists", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await inventoryService.getAvailability("rt1", "2026-01-15");

      expect(result).toEqual({ available: 0, blocked: 0 });
    });
  });

  describe("block", () => {
    it("should block rooms successfully", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 10,
        blocked_count: 0,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        available_count: 7,
        blocked_count: 3,
      });

      const result = await inventoryService.block("rt1", "2026-01-15", 3);

      expect(result).toEqual({ available: 7, blocked: 3 });
    });

    it("should throw when blocking more than available", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 2,
        blocked_count: 0,
      });

      await expect(
        inventoryService.block("rt1", "2026-01-15", 5)
      ).rejects.toThrow(AppError);
    });

    it("should throw when inventory not found", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      await expect(
        inventoryService.block("rt1", "2026-01-15", 1)
      ).rejects.toThrow(AppError);
    });
  });

  describe("unblock", () => {
    it("should unblock rooms successfully", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 7,
        blocked_count: 3,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        available_count: 10,
        blocked_count: 0,
      });

      const result = await inventoryService.unblock("rt1", "2026-01-15", 3);

      expect(result).toEqual({ available: 10, blocked: 0 });
    });

    it("should throw when unblocking more than blocked", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 7,
        blocked_count: 2,
      });

      await expect(
        inventoryService.unblock("rt1", "2026-01-15", 5)
      ).rejects.toThrow(AppError);
    });
  });
});