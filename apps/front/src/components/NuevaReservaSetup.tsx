"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomType } from "@/lib/api";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";

interface NuevaReservaSetupProps {
  hotelId: string;
  roomTypes: RoomType[];
  initialRoomTypeId?: string;
  initialDate?: string;
}

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
const labelClass =
  "block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200";

export default function NuevaReservaSetup({
  hotelId,
  roomTypes,
  initialRoomTypeId = "",
  initialDate = "",
}: NuevaReservaSetupProps) {
  const router = useRouter();
  const [roomTypeId, setRoomTypeId] = useState(initialRoomTypeId);
  const [date, setDate] = useState(initialDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTypeId || !date) return;
    const params = new URLSearchParams({
      hotel: hotelId,
      room_type_id: roomTypeId,
      date,
    });
    router.push(`/reservas/nueva?${params.toString()}`);
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-semibold">Elegí habitación y fecha</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="setup-room-type" className={labelClass}>
            Tipo de habitación
          </label>
          {roomTypes.length > 0 ? (
            <select
              id="setup-room-type"
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Elegí una opción…</option>
              {roomTypes.map((r) => (
                <option key={r.room_type_id} value={r.room_type_id}>
                  {r.name} · máx. {r.capacity}{" "}
                  {r.capacity === 1 ? "huésped" : "huéspedes"}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Este hotel no tiene tipos de habitación cargados.
            </p>
          )}
        </div>
        <div>
          <span id="setup-date-label" className={labelClass}>
            Fecha de check-in
          </span>
          <AvailabilityCalendar
            roomTypeId={roomTypeId || undefined}
            selected={date || undefined}
            onSelect={setDate}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {roomTypeId
              ? "Los días en verde tienen habitaciones libres."
              : "Elegí primero el tipo de habitación."}
          </p>
        </div>
        <button
          type="submit"
          disabled={!roomTypeId || !date}
          className="rounded bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 touch-manipulation disabled:opacity-50"
        >
          Continuar
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        O consultá disponibilidad primero desde{" "}
        <a
          href={`/hotels/${encodeURIComponent(hotelId)}/availability`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          la página del hotel
        </a>
        .
      </p>
    </div>
  );
}
