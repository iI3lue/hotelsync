import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/error-handler.js";

export class InventoryService {
  async getAvailability(roomTypeId: string, date: string) {
    const inventory = await prisma.inventory.findUnique({
      where: {
        room_type_id_date: {
          room_type_id: roomTypeId,
          date: new Date(date),
        },
      },
    });

    if (!inventory) {
      return { available: 0, blocked: 0 };
    }

    return {
      available: inventory.available_count,
      blocked: inventory.blocked_count,
    };
  }

  async block(roomTypeId: string, date: string, count: number) {
    const inventory = await prisma.inventory.findUnique({
      where: {
        room_type_id_date: {
          room_type_id: roomTypeId,
          date: new Date(date),
        },
      },
    });

    if (!inventory) {
      throw new AppError(
        404,
        `No inventory found for room type ${roomTypeId} on ${date}`,
        "Not Found"
      );
    }

    if (count > inventory.available_count) {
      throw new AppError(
        400,
        `Cannot block ${count} rooms: only ${inventory.available_count} available`,
        "Bad Request"
      );
    }

    const updated = await prisma.inventory.update({
      where: {
        room_type_id_date: {
          room_type_id: roomTypeId,
          date: new Date(date),
        },
      },
      data: {
        available_count: inventory.available_count - count,
        blocked_count: inventory.blocked_count + count,
      },
    });

    return {
      available: updated.available_count,
      blocked: updated.blocked_count,
    };
  }

  async unblock(roomTypeId: string, date: string, count: number) {
    const inventory = await prisma.inventory.findUnique({
      where: {
        room_type_id_date: {
          room_type_id: roomTypeId,
          date: new Date(date),
        },
      },
    });

    if (!inventory) {
      throw new AppError(
        404,
        `No inventory found for room type ${roomTypeId} on ${date}`,
        "Not Found"
      );
    }

    if (count > inventory.blocked_count) {
      throw new AppError(
        400,
        `Cannot unblock ${count} rooms: only ${inventory.blocked_count} blocked`,
        "Bad Request"
      );
    }

    const updated = await prisma.inventory.update({
      where: {
        room_type_id_date: {
          room_type_id: roomTypeId,
          date: new Date(date),
        },
      },
      data: {
        available_count: inventory.available_count + count,
        blocked_count: inventory.blocked_count - count,
      },
    });

    return {
      available: updated.available_count,
      blocked: updated.blocked_count,
    };
  }

  async setInventory(roomTypeId: string, date: string, availableCount: number) {
    const existing = await prisma.inventory.findUnique({
      where: {
        room_type_id_date: {
          room_type_id: roomTypeId,
          date: new Date(date),
        },
      },
    });

    if (existing) {
      return prisma.inventory.update({
        where: {
          room_type_id_date: {
            room_type_id: roomTypeId,
            date: new Date(date),
          },
        },
        data: { available_count: availableCount },
      });
    }

    return prisma.inventory.create({
      data: {
        room_type_id: roomTypeId,
        date: new Date(date),
        available_count: availableCount,
        blocked_count: 0,
      },
    });
  }
}

export const inventoryService = new InventoryService();