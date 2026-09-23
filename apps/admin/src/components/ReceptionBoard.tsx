"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingRef } from "@/lib/api";
import { useRoomNames } from "@/lib/use-room-names";

interface ReceptionBoardProps {
  hotelId: string;
  date: string;
}

const inputClass =
  "rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json();
}

export default function ReceptionBoard({ hotelId, date }: ReceptionBoardProps) {
  const [arrivals, setArrivals] = useState<BookingRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const roomNames = useRoomNames(hotelId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/front-desk/arrivals?hotel_id=${encodeURIComponent(hotelId)}&date=${encodeURIComponent(date)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      setArrivals(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las llegadas");
    } finally {
      setLoading(false);
    }
  }, [hotelId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheckIn = async (bookingId: string) => {
    const room = (rooms[bookingId] || "").trim();
    if (!room) {
      setError("Ingresá el número de habitación física para el check-in");
      return;
    }
    setBusy(bookingId);
    setError(null);
    setNotice(null);
    try {
      await postJson("/api/front-desk/check-in", {
        booking_id: bookingId,
        physical_room_number: room,
      });
      setNotice(`Check-in OK: reserva ${bookingId.slice(0, 8)}… en habitación ${room}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo hacer el check-in");
    } finally {
      setBusy(null);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    setBusy(bookingId);
    setError(null);
    setNotice(null);
    try {
      await postJson("/api/front-desk/check-out", { booking_id: bookingId });
      setNotice(`Check-out OK: reserva ${bookingId.slice(0, 8)}… (checkout.completed emitido)`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo hacer el check-out");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <p role="status" className="text-gray-500 dark:text-gray-400">
        Cargando llegadas…
      </p>
    );
  }

  return (
    <div>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
            {notice}
          </p>
        ) : null}
      </div>

      {!arrivals || arrivals.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-center shadow dark:bg-gray-800">
          <p className="font-medium text-gray-700 dark:text-gray-200">
            No hay llegadas confirmadas para esta fecha.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Este tablero solo muestra confirmed del read model de Front Desk. Mirá la
            pestaña Reservas para ver las pending recién creadas en Booking.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded border border-gray-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div>
          <p role="status" className="mb-3 text-sm text-gray-600 tabular-nums dark:text-gray-300">
            {arrivals.length === 1 ? "1 llegada confirmada" : `${arrivals.length} llegadas confirmadas`}
          </p>
        <ul className="space-y-4">
          {arrivals.map((b) => (
            <li
              key={b.booking_id}
              className="rounded-lg bg-white p-4 shadow dark:bg-gray-800"
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 break-words">
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {b.booking_id.slice(0, 8)}…
                </span>
                <span className="text-sm font-medium">
                  {roomNames[b.room_type_id] ?? "Habitación"}
                </span>
                <span className="text-sm">
                  {b.check_in} → {b.check_out}
                </span>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-200">
                  {b.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor={`room-${b.booking_id}`} className="sr-only">
                  Habitación física
                </label>
                <input
                  id={`room-${b.booking_id}`}
                  type="text"
                  placeholder="Hab. física (ej. 101)"
                  value={rooms[b.booking_id] || ""}
                  onChange={(e) =>
                    setRooms((prev) => ({ ...prev, [b.booking_id]: e.target.value }))
                  }
                  className={`${inputClass} w-44`}
                />
                <button
                  type="button"
                  onClick={() => handleCheckIn(b.booking_id)}
                  disabled={busy === b.booking_id}
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 touch-manipulation disabled:opacity-50"
                >
                  {busy === b.booking_id ? "Procesando…" : "Check-in"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckOut(b.booking_id)}
                  disabled={busy === b.booking_id}
                  className="rounded border border-gray-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Check-out
                </button>
              </div>
            </li>
          ))}
        </ul>
        </div>
      )}
    </div>
  );
}
