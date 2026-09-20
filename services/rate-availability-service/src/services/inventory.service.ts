import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/error-handler.js";

function enumerateDates(startDate: string, endDate: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current < end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

  /**
   * Reserva inventario para un rango de fechas (RN-1).
   * Decrementa `available_count` con bloqueo optimista (CAS): si en alguna
   * fecha no hay stock, la transacción se aborta y no queda decremento parcial.
   */
  async reserve(roomTypeId: string, checkIn: string, checkOut: string, count = 1) {
    const dates = enumerateDates(checkIn, checkOut);

    if (dates.length === 0) {
      throw new AppError(400, "check_out must be after check_in", "Bad Request");
    }

    await prisma.$transaction(async (tx) => {
      for (const date of dates) {
        const result = await tx.inventory.updateMany({
          where: {
            room_type_id: roomTypeId,
            date,
            available_count: { gte: count },
          },
          data: { available_count: { decrement: count } },
        });

        if (result.count === 0) {
          throw new AppError(
            409,
            `Insufficient availability on ${formatDate(date)} for room type ${roomTypeId}`,
            "Conflict"
          );
        }
      }
    });

    return { reserved: true, start_date: checkIn, end_date: checkOut, count };
  }

  /**
   * Libera inventario reservado para un rango de fechas (RN-2).
   * Incrementa `available_count` por cada fecha de la estancia.
   */
  async release(roomTypeId: string, checkIn: string, checkOut: string, count = 1) {
    const dates = enumerateDates(checkIn, checkOut);

    if (dates.length === 0) {
      throw new AppError(400, "check_out must be after check_in", "Bad Request");
    }

    await prisma.$transaction(async (tx) => {
      for (const date of dates) {
        await tx.inventory.updateMany({
          where: { room_type_id: roomTypeId, date },
          data: { available_count: { increment: count } },
        });
      }
    });

    return { released: true, start_date: checkIn, end_date: checkOut, count };
  }
}

export const inventoryService = new InventoryService();
