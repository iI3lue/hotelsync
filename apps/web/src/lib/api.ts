import { cache } from "react";

const PROPERTY_API = process.env.NEXT_PUBLIC_PROPERTY_API_URL || "http://localhost:3001/v1";
const RATE_API = process.env.NEXT_PUBLIC_RATE_API_URL || "http://localhost:3002/v1";
const BOOKING_API = process.env.NEXT_PUBLIC_BOOKING_API_URL || "http://localhost:3004/v1";

export interface Hotel {
  hotel_id: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  roomTypes: RoomType[];
  cancellationPolicies: CancellationPolicy[];
}

export interface RoomType {
  room_type_id: string;
  hotel_id: string;
  name: string;
  capacity: number;
  base_rate: number;
  amenities: string[];
}

export interface CancellationPolicy {
  policy_id: string;
  hotel_id: string;
  name: string;
  description: string;
}

export interface Availability {
  available: number;
  blocked: number;
}

export interface Booking {
  booking_id: string;
  guest_id: string;
  hotel_id: string;
  room_type_id: string;
  check_in: string;
  check_out: string;
  status: "pending" | "confirmed" | "cancelled";
  channel: "direct" | "ota" | "phone";
  total_amount: number | string;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchHotels(): Promise<Hotel[]> {
  return cachedFetchHotels();
}

export async function fetchHotelById(id: string): Promise<Hotel> {
  return cachedFetchHotelById(id);
}

export async function fetchRoomTypes(hotelId: string): Promise<RoomType[]> {
  return cachedFetchRoomTypes(hotelId);
}

// Per-request dedup (server-cache-react): misma URL = 1 solo viaje al backend.
const cachedFetchHotels = cache(async (): Promise<Hotel[]> => {
  return apiFetch<Hotel[]>(`${PROPERTY_API}/hotels`);
});

const cachedFetchHotelById = cache(async (id: string): Promise<Hotel> => {
  return apiFetch<Hotel>(`${PROPERTY_API}/hotels/${id}`);
});

const cachedFetchRoomTypes = cache(async (hotelId: string): Promise<RoomType[]> => {
  return apiFetch<RoomType[]>(`${PROPERTY_API}/hotels/${hotelId}/room-types`);
});

export interface HotelFilters {
  city?: string;
  amenity?: string;
  minCapacity?: number;
}

export function filterHotels(hotels: Hotel[], filters: HotelFilters): Hotel[] {
  const city = filters.city?.trim().toLowerCase();
  const amenity = filters.amenity?.trim().toLowerCase();
  const minCapacity = filters.minCapacity;
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

export async function fetchAvailability(
  roomTypeId: string,
  date: string
): Promise<Availability> {
  return apiFetch<Availability>(
    `${RATE_API}/availability?room_type_id=${roomTypeId}&date=${date}`
  );
}

export async function fetchBookingById(id: string): Promise<Booking> {
  return apiFetch<Booking>(`${BOOKING_API}/bookings/${id}`);
}
