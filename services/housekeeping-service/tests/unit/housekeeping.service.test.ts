import { housekeepingService } from "../../src/services/housekeeping.service.js";
import { AppError } from "../../src/middleware/error-handler.js";

jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  default: {
    cleaningHistory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    roomStatus: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from "../../src/lib/prisma.js";

const mockPrisma = prisma as any;
mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

const USER_ID = "11111111-2222-4333-8444-555555555555";
const TASK_ID = "22222222-2222-4333-8444-555555555555";

describe("HousekeepingService identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listMine", () => {
    it("filters tasks by the authenticated user", async () => {
      mockPrisma.cleaningHistory.findMany.mockResolvedValue([]);

      await housekeepingService.listMine(USER_ID, {});

      expect(mockPrisma.cleaningHistory.findMany).toHaveBeenCalledWith({
        where: { assigned_to_user_id: USER_ID },
        orderBy: { created_at: "asc" },
      });
    });

    it("combines user filter with status", async () => {
      mockPrisma.cleaningHistory.findMany.mockResolvedValue([]);

      await housekeepingService.listMine(USER_ID, { status: "assigned" });

      expect(mockPrisma.cleaningHistory.findMany).toHaveBeenCalledWith({
        where: { assigned_to_user_id: USER_ID, status: "assigned" },
        orderBy: { created_at: "asc" },
      });
    });
  });

  describe("assignTask", () => {
    it("assigns a pending task to a user uuid", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue({
        history_id: TASK_ID,
        status: "pending",
      });
      mockPrisma.cleaningHistory.update.mockResolvedValue({
        history_id: TASK_ID,
        status: "assigned",
      });

      const result = await housekeepingService.assignTask(TASK_ID, {
        assigned_to_user_id: USER_ID,
      });

      expect(mockPrisma.cleaningHistory.update).toHaveBeenCalledWith({
        where: { history_id: TASK_ID },
        data: {
          status: "assigned",
          assigned_to_user_id: USER_ID,
          assigned_to: null,
        },
      });
      expect(result.status).toBe("assigned");
    });

    it("rejects assigning a non-pending task", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue({
        history_id: TASK_ID,
        status: "done",
      });

      await expect(
        housekeepingService.assignTask(TASK_ID, { assigned_to_user_id: USER_ID })
      ).rejects.toThrow(AppError);
      expect(mockPrisma.cleaningHistory.update).not.toHaveBeenCalled();
    });
  });

  describe("assignTask assignee validation", () => {
    const HOTEL_ID = "c1b2c3d4-e5f6-4890-abcd-ef1234567890";
    const pendingTask = { history_id: TASK_ID, hotel_id: HOTEL_ID, status: "pending" };

    beforeEach(() => {
      process.env.USER_SERVICE_URL = "http://user-service:3003/v1";
    });

    afterEach(() => {
      delete process.env.USER_SERVICE_URL;
      jest.restoreAllMocks();
    });

    it("rejects an assignee outside the hotel staff", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue(pendingTask);
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => [],
      } as any);

      await expect(
        housekeepingService.assignTask(TASK_ID, { assigned_to_user_id: USER_ID }, "Bearer x")
      ).rejects.toThrow(AppError);
      expect(mockPrisma.cleaningHistory.update).not.toHaveBeenCalled();
    });

    it("accepts active cleaning staff of the hotel", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue(pendingTask);
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => [
          {
            user_id: USER_ID,
            assignments: [{ role: "HOUSEKEEPER", hotel_id: HOTEL_ID, is_active: true }],
          },
        ],
      } as any);
      mockPrisma.cleaningHistory.update.mockResolvedValue({ status: "assigned" });

      const result = await housekeepingService.assignTask(
        TASK_ID,
        { assigned_to_user_id: USER_ID },
        "Bearer x"
      );

      expect(result.status).toBe("assigned");
    });
  });

  describe("completeTask", () => {
    it("records who completed the task and when", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue({
        history_id: TASK_ID,
        room_status_id: "33333333-3333-4333-8444-555555555555",
        status: "in_progress",
        assigned_to_user_id: USER_ID,
      });
      mockPrisma.cleaningHistory.update.mockResolvedValue({
        history_id: TASK_ID,
        status: "done",
      });
      mockPrisma.roomStatus.update.mockResolvedValue({ status: "clean" });

      const result = await housekeepingService.completeTask(TASK_ID, USER_ID);

      expect(mockPrisma.cleaningHistory.update).toHaveBeenCalledWith({
        where: { history_id: TASK_ID },
        data: {
          status: "done",
          completed_by_user_id: USER_ID,
          completed_at: expect.any(Date),
        },
      });
      expect(mockPrisma.roomStatus.update).toHaveBeenCalledWith({
        where: { room_status_id: "33333333-3333-4333-8444-555555555555" },
        data: { status: "clean" },
      });
      expect(result.status).toBe("done");
    });

    it("rejects completion by someone other than the assignee", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue({
        history_id: TASK_ID,
        hotel_id: "c1b2c3d4-e5f6-4890-abcd-ef1234567890",
        room_status_id: "33333333-3333-4333-8444-555555555555",
        status: "in_progress",
        assigned_to_user_id: USER_ID,
      });

      await expect(
        housekeepingService.completeTask(TASK_ID, "other-user", {
          sub: "other-user",
          email: "o@example.com",
          role: "HOUSEKEEPER",
          hotel_id: "c1b2c3d4-e5f6-4890-abcd-ef1234567890",
          scope: "hotel",
          iat: 0,
          exp: 9999999999,
        })
      ).rejects.toThrow(AppError);
      expect(mockPrisma.cleaningHistory.update).not.toHaveBeenCalled();
    });

    it("lets a manager of the hotel complete any task", async () => {
      mockPrisma.cleaningHistory.findUnique.mockResolvedValue({
        history_id: TASK_ID,
        hotel_id: "c1b2c3d4-e5f6-4890-abcd-ef1234567890",
        room_status_id: "33333333-3333-4333-8444-555555555555",
        status: "in_progress",
        assigned_to_user_id: USER_ID,
      });
      mockPrisma.cleaningHistory.update.mockResolvedValue({ status: "done" });
      mockPrisma.roomStatus.update.mockResolvedValue({ status: "clean" });

      const result = await housekeepingService.completeTask(TASK_ID, "manager", {
        sub: "manager",
        email: "m@example.com",
        role: "MANAGER",
        hotel_id: "c1b2c3d4-e5f6-4890-abcd-ef1234567890",
        scope: "hotel",
        iat: 0,
        exp: 9999999999,
      });

      expect(result.status).toBe("done");
    });
  });
});
