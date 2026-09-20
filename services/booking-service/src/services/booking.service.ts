import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/error-handler.js";
import { publishEvent } from "../lib/events.js";
import {
  CreateBookingInput,
  ListBookingsQuery,
} from "../validators/booking.js";

export class BookingService {
  async create(data: CreateBookingInput) {
    if (data.check_out <= data.check_in) {
      throw new AppError(
        400,
        "check_out must be after check_in",
        "Bad Request"
      );
    }

    const booking = await prisma.booking.create({
      data: {
        guest_id: data.guest_id,
        hotel_id: data.hotel_id,
        room_type_id: data.room_type_id,
        check_in: new Date(data.check_in),
        check_out: new Date(data.check_out),
        channel: data.channel,
        total_amount: data.total_amount,
      },
    });

    publishEvent("booking.created", {
      booking_id: booking.booking_id,
      hotel_id: booking.hotel_id,
      room_type_id: booking.room_type_id,
      channel: booking.channel,
    });

    return booking;
  }

  async findById(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { booking_id: id },
    });

    if (!booking) {
      throw new AppError(404, `Booking with id ${id} not found`, "Not Found");
    }

    return booking;
  }

  async list(query: ListBookingsQuery) {
    return prisma.booking.findMany({
      where: {
        ...(query.hotel_id ? { hotel_id: query.hotel_id } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.date
          ? {
              check_in: { lte: new Date(query.date) },
              check_out: { gte: new Date(query.date) },
            }
          : {}),
      },
      orderBy: { check_in: "asc" },
    });
  }

  /**
   * Confirma una reserva pendiente con bloqueo optimista (RN anti-sobreventa).
   * Si la reserva cambió entre la lectura y la escritura, retorna 409.
   */
  async confirm(id: string) {
    const existing = await prisma.booking.findUnique({
      where: { booking_id: id },
    });

    if (!existing) {
      throw new AppError(404, `Booking with id ${id} not found`, "Not Found");
    }

    if (existing.status !== "pending") {
      throw new AppError(
        409,
        `Cannot confirm booking with status ${existing.status}`,
        "Conflict"
      );
    }

    const updated = await prisma.booking.updateMany({
      where: {
        booking_id: id,
        status: "pending",
        version: existing.version,
      },
      data: {
        status: "confirmed",
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        409,
        "Booking was modified concurrently, please retry",
        "Conflict"
      );
    }

    return this.findById(id);
  }

  async cancel(id: string) {
    const existing = await prisma.booking.findUnique({
      where: { booking_id: id },
    });

    if (!existing) {
      throw new AppError(404, `Booking with id ${id} not found`, "Not Found");
    }

    if (existing.status === "cancelled") {
      throw new AppError(409, "Booking is already cancelled", "Conflict");
    }

    const cancelled = await prisma.booking.update({
      where: { booking_id: id },
      data: { status: "cancelled" },
    });

    publishEvent("booking.cancelled", {
      booking_id: cancelled.booking_id,
      hotel_id: cancelled.hotel_id,
      room_type_id: cancelled.room_type_id,
    });

    return cancelled;
  }
}

export const bookingService = new BookingService();