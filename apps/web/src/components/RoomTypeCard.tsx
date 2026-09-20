import type { RoomType } from "@/lib/api";

export default function RoomTypeCard({ roomType }: { roomType: RoomType }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-2">{roomType.name}</h3>
      <p className="text-gray-600 mb-2 dark:text-gray-300">
        Capacidad: {roomType.capacity}{" "}
        {roomType.capacity === 1 ? "huésped" : "huéspedes"}
      </p>
      <p className="text-blue-600 font-bold text-lg mb-3 dark:text-blue-400">
        ${Number(roomType.base_rate).toLocaleString("es-AR")} / noche
      </p>
      {roomType.amenities && roomType.amenities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {roomType.amenities.map((amenity) => (
            <span
              key={amenity}
              className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-200"
            >
              {amenity.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
