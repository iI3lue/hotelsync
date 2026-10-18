import type { Booking } from "./api";

/** Fecha local en formato `YYYY-MM-DD` (no UTC). */
export function localIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * `check_out` llega como DATE serializada (`2026-11-10T00:00:00.000Z`).
 * Se compara solo la parte de fecha para no correr el día por zona horaria.
 */
export function checkOutIsoDate(
  booking: Pick<Booking, "check_out">
): string | null {
  return booking.check_out ? booking.check_out.slice(0, 10) : null;
}

/**
 * La reserva sigue en "Mis reservas" durante todo el día de salida y
 * desaparece al día siguiente. Las canceladas se ocultan de inmediato.
 */
export function isVisibleMyBooking(
  booking: Pick<Booking, "check_out"> & Partial<Pick<Booking, "status">>,
  today: string = localIsoDate()
): boolean {
  if (booking.status === "cancelled") return false;
  const checkOut = checkOutIsoDate(booking);
  return checkOut === null || checkOut >= today;
}

export function visibleMyBookings<
  T extends Pick<Booking, "check_out"> & Partial<Pick<Booking, "status">>
>(bookings: T[], today: string = localIsoDate()): T[] {
  return bookings.filter((booking) => isVisibleMyBooking(booking, today));
}

export function isPaidBooking(booking: Pick<Booking, "payment_status">): boolean {
  return booking.payment_status === "PAID";
}
