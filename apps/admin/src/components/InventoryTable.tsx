"use client";

import { useState } from "react";
import { blockInventory } from "@/lib/api";

const inputClass =
  "w-full border border-gray-300 rounded px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
const labelClass =
  "block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200";

export default function InventoryTable({ hotelId }: { hotelId: string }) {
  const [roomTypeId, setRoomTypeId] = useState("");
  const [date, setDate] = useState("");
  const [count, setCount] = useState(1);
  const [action, setAction] = useState<"block" | "unblock">("block");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    available: number;
    blocked: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await blockInventory({
        room_type_id: roomTypeId,
        date,
        count,
        action,
      });
      setResult(res);
    } catch (err) {
      console.error(err);
      setError(
        "No se pudo actualizar el inventario. Verificá los datos e intentá de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="text-red-600 bg-red-50 p-3 rounded dark:bg-red-900/30 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="inventory-room-type" className={labelClass}>
            ID de tipo de habitación
          </label>
          <input
            id="inventory-room-type"
            type="text"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="inventory-date" className={labelClass}>
            Fecha
          </label>
          <input
            id="inventory-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} dark:[color-scheme:dark]`}
            required
          />
        </div>
        <div>
          <label htmlFor="inventory-count" className={labelClass}>
            Cantidad
          </label>
          <input
            id="inventory-count"
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="inventory-action" className={labelClass}>
            Acción
          </label>
          <select
            id="inventory-action"
            value={action}
            onChange={(e) => setAction(e.target.value as "block" | "unblock")}
            className={inputClass}
          >
            <option value="block">Bloquear</option>
            <option value="unblock">Desbloquear</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? "Procesando..." : "Actualizar inventario"}
      </button>

      {result && (
        <div
          role="status"
          className="mt-4 p-4 bg-gray-50 rounded dark:bg-gray-700"
        >
          <p>
            Disponibles: <strong>{result.available}</strong>
          </p>
          <p>
            Bloqueadas: <strong>{result.blocked}</strong>
          </p>
        </div>
      )}
    </form>
  );
}
