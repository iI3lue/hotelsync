import type { Hotel } from "./api";

/**
 * Helpers puros (sin fetch ni APIs de servidor): seguros para importar
 * desde Client Components sin arrastrar el módulo servidor.
 */

export interface HotelFilters {
  city?: string;
  amenity?: string;
  minCapacity?: number;
}

/**
 * Filtro unificado: acepta el objeto de la web pública
 * ({city, amenity, minCapacity}) o el query simple del admin (string).
 */
export function filterHotels(hotels: Hotel[], filters?: HotelFilters | string): Hotel[] {
  if (typeof filters === "string") {
    const q = filters.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter((hotel) =>
      `${hotel.name} ${hotel.city} ${hotel.country}`.toLowerCase().includes(q)
    );
  }
  const city = filters?.city?.trim().toLowerCase();
  const amenity = filters?.amenity?.trim().toLowerCase();
  const minCapacity = filters?.minCapacity;
  if (!city && !amenity && !minCapacity) return hotels;
  return hotels.filter((hotel) => {
    if (
      city &&
      !`${hotel.name} ${hotel.city} ${hotel.country}`.toLowerCase().includes(city)
    ) {
      return false;
    }
    const roomTypes = hotel.roomTypes ?? [];
    if (amenity && !roomTypes.some((r) => (r.amenities ?? []).some((a) => a.toLowerCase().includes(amenity)))) {
      return false;
    }
    if (minCapacity && !roomTypes.some((r) => r.capacity >= minCapacity)) {
      return false;
    }
    return true;
  });
}

const priceFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number | string): string {
  return priceFormatter.format(Number(value));
}

export function formatDate(dateIso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateIso}T12:00:00`));
  } catch {
    return dateIso;
  }
}

export function minRate(hotel: Hotel): number | null {
  const rates = (hotel.roomTypes ?? []).map((r) => Number(r.base_rate));
  if (rates.length === 0) return null;
  return Math.min(...rates);
}
