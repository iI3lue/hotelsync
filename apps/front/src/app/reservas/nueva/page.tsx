import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import BookingForm from "@/components/BookingForm";
import NuevaReservaSetup from "@/components/NuevaReservaSetup";
import { fetchRoomTypes } from "@/lib/api";

export const metadata: Metadata = {
  title: "Nueva reserva en HotelSync",
  description: "Completá tu reserva directa con confirmación sin sobreventa.",
};

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string; room_type_id?: string; date?: string }>;
}) {
  const { hotel, room_type_id, date } = await searchParams;
  const ready = Boolean(hotel && room_type_id && date);

  let roomTypes: Awaited<ReturnType<typeof fetchRoomTypes>> = [];
  if (hotel && !ready) {
    try {
      roomTypes = await fetchRoomTypes(hotel);
    } catch {
      roomTypes = [];
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Reserva" }]} />
      <h1 className="mb-2 text-balance text-3xl font-bold">Tu reserva</h1>
      <p className="mb-6 max-w-2xl break-words text-gray-600 dark:text-gray-300">
        Reserva directa sobre Booking Service (BK-1): se crea en estado{" "}
        <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">pending</code>{" "}
        y se confirma con bloqueo optimista para evitar sobreventa.
      </p>
      {ready ? (
        <BookingForm hotelId={hotel!} roomTypeId={room_type_id!} date={date!} />
      ) : hotel ? (
        <NuevaReservaSetup
          hotelId={hotel}
          roomTypes={roomTypes}
          initialRoomTypeId={room_type_id ?? ""}
          initialDate={date ?? ""}
        />
      ) : (
        <div
          role="status"
          className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800"
        >
          <p className="text-gray-600 dark:text-gray-300">
            Falta el hotel. Empezá eligiendo disponibilidad desde el{" "}
            <a
              href="/"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              listado de hoteles
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
