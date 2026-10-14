import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getBookingDetails } from "../lib/booking-client";
import { authorizeCard } from "../lib/mock-gateway";
import { publishEvent } from "../lib/broker";
import { AppError } from "../middleware/error-handler";
import type { CardInput, PaymentChannel, PaymentMethod } from "../types";

async function emitPaymentCompleted(tx: {
  transaction_id: string;
  booking_id: string;
  amount: unknown;
  currency: string;
}): Promise<void> {
  const payload = {
    booking_id: tx.booking_id,
    transaction_id: tx.transaction_id,
    amount: Number(tx.amount),
    currency: tx.currency,
  };
  await prisma.eventOutbox.create({
    data: {
      event_id: randomUUID(),
      event_type: "payment.completed",
      payload,
      status: process.env.RABBITMQ_URL ? "sent" : "pending",
    },
  });
  await publishEvent("payment.completed", payload);
}

export async function processWebPayment(userId: string, bookingId: string, card: CardInput) {
  const booking = await getBookingDetails(bookingId);
  if (!booking) throw new AppError(404, "Reserva no encontrada", "NotFound");

  // Idempotencia: reintentar el cobro de la misma reserva devuelve la
  // transacción existente, nunca un doble cargo.
  const existing = await prisma.paymentTransaction.findUnique({ where: { booking_id: bookingId } });
  if (existing) return existing;

  const amount = Number(booking.total_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(422, "La reserva no tiene un total cobrable", "InvalidAmount");
  }

  const auth = authorizeCard(card, Math.round(amount * 100));
  if (!auth.authorized) {
    await prisma.paymentTransaction.create({
      data: {
        booking_id: bookingId,
        user_id: userId,
        amount,
        method: "CREDIT_CARD",
        status: "FAILED",
        channel: "WEB",
        failure_reason: auth.reason,
      },
    });
    // Decisión PRD 2026-10-14: la reserva queda pendiente para reintentar.
    throw new AppError(402, auth.reason ?? "Pago rechazado", "PaymentFailed");
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      booking_id: bookingId,
      user_id: userId,
      amount,
      method: "CREDIT_CARD",
      status: "COMPLETED",
      channel: "WEB",
    },
  });
  await emitPaymentCompleted(tx);
  return tx;
}

export async function processFrontDeskPayment(
  bookingId: string,
  method: Extract<PaymentMethod, "CASH" | "TRANSFER" | "TERMINAL">,
  channel: PaymentChannel = "FRONT_DESK"
) {
  const booking = await getBookingDetails(bookingId);
  if (!booking) throw new AppError(404, "Reserva no encontrada", "NotFound");

  const existing = await prisma.paymentTransaction.findUnique({ where: { booking_id: bookingId } });
  if (existing) return existing;

  const amount = Number(booking.total_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(422, "La reserva no tiene un total cobrable", "InvalidAmount");
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      booking_id: bookingId,
      amount,
      method,
      status: "COMPLETED",
      channel,
    },
  });
  await emitPaymentCompleted(tx);
  return tx;
}

export async function getPaymentByBooking(bookingId: string) {
  return prisma.paymentTransaction.findUnique({ where: { booking_id: bookingId } });
}
