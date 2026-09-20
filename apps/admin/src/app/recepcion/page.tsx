import type { Metadata } from "next";
import ReceptionBoard from "@/components/ReceptionBoard";

export const metadata: Metadata = {
  title: "Recepción en HotelSync",
  description: "Llegadas del día, check-in con habitación física y check-out.",
};

const inputClass =
  "rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
const labelClass =
  "block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200";

export default async function RecepcionPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel_id?: string; date?: string }>;
}) {
  const { hotel_id, date } = await searchParams;
  const ready = Boolean(hotel_id && date);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Recepción</h1>
      <p className="mb-6 max-w-2xl break-words text-gray-600 dark:text-gray-300">
        Llegadas del día desde Booking Service y operación sobre Front Desk
        Service: check-in con asignación de habitación física y check-out
        (emite <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">checkout.completed</code>).
      </p>

      <form
        method="get"
        action="/recepcion"
        className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-2">
            <label htmlFor="hotel-id" className={labelClass}>
              ID del hotel
            </label>
            <input
              id="hotel-id"
              name="hotel_id"
              type="text"
              autoComplete="off"
              spellCheck={false}
              defaultValue={hotel_id || ""}
              placeholder="Pegá el hotel_id…"
              className={inputClass + " w-full"}
              required
            />
          </div>
          <div>
            <label htmlFor="arrival-date" className={labelClass}>
              Fecha
            </label>
            <input
              id="arrival-date"
              name="date"
              type="date"
              defaultValue={date || ""}
              className={inputClass + " w-full dark:[color-scheme:dark]"}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 touch-manipulation"
        >
          Ver llegadas
        </button>
      </form>

      {ready ? (
        <ReceptionBoard hotelId={hotel_id!} date={date!} />
      ) : (
        <p className="text-gray-500 dark:text-gray-400">
          Elegí un hotel y una fecha para ver las llegadas confirmadas.
        </p>
      )}
    </div>
  );
}
