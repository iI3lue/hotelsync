import { bookingService } from "../../src/services/booking.service.js";
import { AppError } from "../../src/middleware/error-handler.js";

// Mock Prisma
jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  default: {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Silence event stub logs
jest.mock("../../src/lib/events.js", () => ({
  publishEvent: jest.fn(),
}));

import prisma from "../../src/lib/prisma.js";

const mockPrisma = prisma as any;

const VALID_UUID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const GUEST_ID = "b1b2c3d4-e5f6-4890-abcd-ef1234567890";
const HOTEL_ID = "c1b2c3d4-e5f6-4890-abcd-ef1234567890";
const ROOM_TYPE_ID = "d1b2c3d4-e5f6-4890-abcd-ef1234567890";

const baseInput = {
  guest_id: GUEST_ID,
  hotel_id: HOTEL_ID,
  room_type_id: ROOM_TYPE_ID,
  check_in: "2026-10-01",
  check_out: "2026-10-05",
  channel: "direct" as const,
  total_amount: 25500,
};

describe("BookingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a pending booking and emit booking.created", async () => {
      const created = { booking_id: VALID_UUID, status: "pending", ...baseInput };
      mockPrisma.booking.create.mockResolvedValue(created);

      const result = await bookingService.create(baseInput);

      expect(result).toEqual(created);
      expect(mockPrisma.booking.create).toHaveBeenCalledWith({
        data: {
          guest_id: GUEST_ID,
          hotel_id: HOTEL_ID,
          room_type_id: ROOM_TYPE_ID,
          check_in: new Date("2026-10-01"),
          check_out: new Date("2026-10-05"),
          channel: "direct",
          total_amount: 25500,
        },
      });
    });

    it("should reject when check_out is not after check_in", async () => {
      await expect(
        bookingService.create({
          ...baseInput,
          check_in: "2026-10-05",
          check_out: "2026-10-05",
        })
      ).rejects.toThrow(AppError);
      expect(mockPrisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("should return booking when found", async () => {
      const booking = { booking_id: VALID_UUID, status: "pending" };
      mockPrisma.booking.findUnique.mockResolvedValue(booking);

      const result = await bookingService.findById(VALID_UUID);

      expect(result).toEqual(booking);
    });

    it("should throw AppError 404 when not found", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(bookingService.findById(VALID_UUID)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("list", () => {
    it("should pass hotel/status/date filters to prisma", async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await bookingService.list({
        hotel_id: HOTEL_ID,
        status: "confirmed",
        date: "2026-10-02",
      });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          hotel_id: HOTEL_ID,
          status: "confirmed",
          check_in: { lte: new Date("2026-10-02") },
          check_out: { gte: new Date("2026-10-02") },
        },
        orderBy: { check_in: "asc" },
      });
    });
  });

  describe("confirm", () => {
    it("should confirm a pending booking", async () => {
      mockPrisma.booking.findUnique
        .mockResolvedValueOnce({
          booking_id: VALID_UUID,
          status: "pending",
          version: 0,
        })
        .mockResolvedValueOnce({
          booking_id: VALID_UUID,
          status: "confirmed",
          version: 1,
        });
      mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });

      const result = await bookingService.confirm(VALID_UUID);

      expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith({
        where: { booking_id: VALID_UUID, status: "pending", version: 0 },
        data: { status: "confirmed", version: { increment: 1 } },
      });
      expect(result.status).toBe("confirmed");
    });

    it("should throw 404 when booking does not exist", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(bookingService.confirm(VALID_UUID)).rejects.toThrow(
        AppError
      );
    });

    it("should throw 409 when booking is not pending", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        booking_id: VALID_UUID,
        status: "confirmed",
        version: 1,
      });

      await expect(bookingService.confirm(VALID_UUID)).rejects.toThrow(
        AppError
      );
      expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it("should throw 409 on concurrent modification", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        booking_id: VALID_UUID,
        status: "pending",
        version: 0,
      });
      mockPrisma.booking.updateMany.mockResolvedValue({ count: 0 });

      await expect(bookingService.confirm(VALID_UUID)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("cancel", () => {
    it("should cancel a booking", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        booking_id: VALID_UUID,
        status: "confirmed",
      });
      mockPrisma.booking.update.mockResolvedValue({
        booking_id: VALID_UUID,
        status: "cancelled",
      });

      const result = await bookingService.cancel(VALID_UUID);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { booking_id: VALID_UUID },
        data: { status: "cancelled" },
      });
      expect(result.status).toBe("cancelled");
    });

    it("should throw 409 when already cancelled", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        booking_id: VALID_UUID,
        status: "cancelled",
      });

      await expect(bookingService.cancel(VALID_UUID)).rejects.toThrow(
        AppError
      );
      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });
  });
});