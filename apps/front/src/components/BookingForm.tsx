"use client";

import { useState } from "react";
import type { Booking } from "@/lib/api";
import { postJson } from "@/lib/api-client";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";

interface BookingFormProps {
  hotelId: string;
  roomTypeId: string;
  date: string;
}

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
const labelClass =
  "block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200";

function newGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}

function plusOneDay(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function BookingForm({ hotelId, roomTypeId, date }: BookingFormProps) {
  const [guestId, setGuestId] = useState(newGuestId);
  const [checkIn, setCheckIn] = useState(date);
  const [checkOut, setCheckOut] = useState(date ? plusOneDay(date) : "");
  const [total, setTotal] = useState("25500");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!checkIn || !checkOut) {
      setError("Elegí las fechas de check-in y check-out en el calendario");
      return;
    }
    setSaving(true);
    try {
      const created = await postJson<Booking>("/api/booking/bookings", {
        guest_id: guestId,
        hotel_id: hotelId,
        room_type_id: roomTypeId,
        check_in: checkIn,
        check_out: checkOut,
        channel: "direct",
        total_amount: Number(total),
      });
      setBooking(created);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear la reserva";
      setError(
        msg.includes("409") || msg.toLowerCase().includes("conflict")
          ? `${msg}. Fechas con alta demanda, probá otro rango.`
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (action: "confirm" | "cancel") => {
    if (!booking) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await postJson<Booking>(
        `/api/booking/bookings/${booking.booking_id}/${action}`,
        {}
      );
      setBooking(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la reserva");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
      {!booking ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Te asignamos un identificador de huésped automáticamente al crear
            la reserva.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className={labelClass}>Check-in</span>
              <AvailabilityCalendar
                roomTypeId={roomTypeId}
                selected={checkIn || undefined}
                onSelect={(iso) => {
                  setCheckIn(iso);
                  if (checkOut && checkOut <= iso) setCheckOut("");
                }}
              />
            </div>
            <div>
              <span className={labelClass}>Check-out</span>
              <AvailabilityCalendar
                roomTypeId={roomTypeId}
                selected={checkOut || undefined}
                onSelect={setCheckOut}
                minDate={checkIn || undefined}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Los días en verde tienen habitaciones libres.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="total-amount" className={labelClass}>
              Monto total
            </label>
            <input
              id="total-amount"
              type="number"
              min="0"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 touch-manipulation disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear reserva"}
          </button>
        </form>
      ) : (
        <div>
          <h2 className="mb-2 text-xl font-semibold">Reserva {booking.status}</h2>
          <dl className="space-y-2 break-words text-sm">
            <div className="flex gap-2">
              <dt className="font-medium">ID:</dt>
              <dd className="font-mono text-xs">{booking.booking_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Estado:</dt>
              <dd>
                <span
                  className={`rounded px-2 py-0.5 font-semibold ${
                    booking.status === "confirmed"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                      : booking.status === "cancelled"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  }`}
                >
                  {booking.status}
                </span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Estadía:</dt>
              <dd>
                {booking.check_in} → {booking.check_out}
              </dd>
            </div>
          </dl>
          {booking.status === "pending" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleTransition("confirm")}
                disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 touch-manipulation disabled:opacity-50"
              >
                {saving ? "Procesando…" : "Confirmar (bloqueo optimista)"}
              </button>
              <button
                type="button"
                onClick={() => handleTransition("cancel")}
                disabled={saving}
                className="rounded border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancelar reserva
              </button>
            </div>
          ) : null}
          {booking.status === "confirmed" ? (
            <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
              Reserva confirmada sin sobreventa (RN-1, BK-4 del PRD). Ya figura en
              recepción del admin automáticamente tras el evento. Presentá
              este ID en recepción para el check-in.
            </p>
          ) : null}
        </div>
      )}

      <div aria-live="polite" className="mt-4">
        {error ? (
          <p role="alert" className="text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
