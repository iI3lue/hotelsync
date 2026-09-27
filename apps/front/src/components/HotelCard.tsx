import Link from "next/link";
import { memo } from "react";
import type { Hotel } from "@/lib/api";
import { formatPrice, minRate } from "@/lib/format";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  const roomTypes = hotel.roomTypes ?? [];
  const roomTypeCount = roomTypes.length;
  const rate = minRate(hotel);
  const amenities = Array.from(
    new Set(roomTypes.flatMap((r) => r.amenities ?? []))
  ).slice(0, 3);
  const lowAvailability = roomTypeCount > 0 && roomTypeCount <= 2;

  return (
    <article
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 320px" }}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg dark:bg-gray-800"
    >
      <div
        aria-hidden="true"
        className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-blue-500 to-blue-800 text-4xl font-bold text-white"
      >
        {initials(hotel.name)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <h2 className="mb-1 truncate text-xl font-semibold">{hotel.name}</h2>
        <p className="mb-3 truncate text-gray-600 dark:text-gray-300">
          {hotel.city}, {hotel.country}
        </p>
        {rate !== null ? (
          <p className="mb-1 text-lg font-bold text-blue-600 tabular-nums dark:text-blue-400">
            {formatPrice(rate)}{" "}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              / noche desde
            </span>
          </p>
        ) : null}
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {roomTypeCount === 0
            ? "Sin tipos de habitación cargados"
            : roomTypeCount === 1
              ? "1 tipo de habitación disponible"
              : `${roomTypeCount} tipos de habitación disponibles`}
        </p>
        {amenities.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <span
                key={amenity}
                className="rounded bg-gray-100 px-2 py-1 text-sm capitalize text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              >
                {amenity.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        ) : null}
        {lowAvailability ? (
          <p className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">
            ¡Quedan pocas opciones en este hotel!
          </p>
        ) : null}
        <div className="mt-auto flex gap-2">
          <Link
            href={`/hotels/${hotel.hotel_id}`}
            className="inline-block rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 touch-manipulation"
          >
            Ver detalles
          </Link>
          <Link
            href={`/hotels/${hotel.hotel_id}/availability`}
            className="inline-block rounded border border-blue-600 px-4 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 touch-manipulation dark:text-blue-400 dark:hover:bg-gray-700"
          >
            Disponibilidad
          </Link>
        </div>
      </div>
    </article>
  );
}

export default memo(HotelCard);
