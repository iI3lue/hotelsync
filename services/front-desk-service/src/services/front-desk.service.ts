import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/error-handler.js";
import { publishEvent } from "../lib/events.js";
import {
  fetchBooking,
  fetchConfirmedBookings,
} from "../lib/booking-client.js";
import {
  ArrivalsQuery,
  CheckInInput,
  CheckOutInput,
  CreateIncidentInput,
} from "../validators/front-desk.js";

export class FrontDeskService {
  /**
   * Llegadas del día: reservas `confirmed` del hotel que cubren la fecha.
   * Lectura vía REST a Booking Service (fuente §6, comunicación síncrona).
   */
  async getArrivals(query: ArrivalsQuery) {
    return fetchConfirmedBookings(query.hotel_id, query.date);
  }

  async checkIn(data: CheckInInput) {
    const booking = await fetchBooking(data.booking_id);

    if (!booking) {
      throw new AppError(
        404,
        `Booking with id ${data.booking_id} not found in Booking Service`,
        "Not Found"
      );
    }

    if (booking.status !== "confirmed") {
      throw new AppError(
        409,
        `Cannot check-in booking with status ${booking.status}`,
        "Conflict"
      );
    }

    const existing = await prisma.roomAssignment.findUnique({
      where: { booking_id: data.booking_id },
    });

    if (existing) {
      throw new AppError(
        409,
        `Booking ${data.booking_id} is already checked in`,
        "Conflict"
      );
    }

    return prisma.roomAssignment.create({
      data: {
        booking_id: data.booking_id,
        physical_room_number: data.physical_room_number,
      },
    });
  }

  async checkOut(data: CheckOutInput) {
    const assignment = await prisma.roomAssignment.findUnique({
      where: { booking_id: data.booking_id },
    });

    if (!assignment) {
      throw new AppError(
        404,
        `No check-in found for booking ${data.booking_id}`,
        "Not Found"
      );
    }

    if (assignment.checked_out_at) {
      throw new AppError(
        409,
        `Booking ${data.booking_id} is already checked out`,
        "Conflict"
      );
    }

    const closed = await prisma.roomAssignment.update({
      where: { booking_id: data.booking_id },
      data: { checked_out_at: new Date() },
    });

    publishEvent("checkout.completed", {
      booking_id: closed.booking_id,
      physical_room_number: closed.physical_room_number,
    });

    return closed;
  }
}

export class IncidentService {
  async create(data: CreateIncidentInput) {
    return prisma.guestIncident.create({
      data: {
        booking_id: data.booking_id,
        description: data.description,
      },
    });
  }

  async list(bookingId?: string) {
    return prisma.guestIncident.findMany({
      where: bookingId ? { booking_id: bookingId } : {},
      orderBy: { created_at: "desc" },
    });
  }

  async setStatus(id: string, status: string) {
    const existing = await prisma.guestIncident.findUnique({
      where: { incident_id: id },
    });

    if (!existing) {
      throw new AppError(
        404,
        `Incident with id ${id} not found`,
        "Not Found"
      );
    }

    return prisma.guestIncident.update({
      where: { incident_id: id },
      data: { status },
    });
  }
}

export const frontDeskService = new FrontDeskService();
export const incidentService = new IncidentService();
