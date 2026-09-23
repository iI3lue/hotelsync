import { cache } from "react";

const PROPERTY_API = process.env.NEXT_PUBLIC_PROPERTY_API_URL || "http://localhost:3001/v1";
const RATE_API = process.env.NEXT_PUBLIC_RATE_API_URL || "http://localhost:3002/v1";
const BOOKING_API = process.env.NEXT_PUBLIC_BOOKING_API_URL || "http://localhost:3004/v1";
const FRONT_DESK_API = process.env.NEXT_PUBLIC_FRONT_DESK_API_URL || "http://localhost:3005/v1";

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

/** Alias de compatibilidad con el admin original. */
export type BookingRef = Booking & {
  status: Booking["status"] | (string & {});
  channel: Booking["channel"] | (string & {});
};

export interface RoomAssignment {
  assignment_id: string;
  booking_id: string;
  physical_room_number: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

export interface GuestIncident {
  incident_id: string;
  booking_id: string;
  description: string;
  status: string;
  created_at: string;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error: ${res.status}`);
  }
  return res.json();
}

async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error: ${res.status}`);
  }
  return res.json();
}

export { apiPut };

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

export async function createHotel(data: {
  name: string;
  city: string;
  country: string;
  timezone: string;
}): Promise<Hotel> {
  return apiPost<Hotel>(`${PROPERTY_API}/hotels`, data);
}

export async function createRoomType(data: {
  hotel_id: string;
  name: string;
  capacity: number;
  base_rate: number;
  amenities: string[];
}): Promise<RoomType> {
  return apiPost<RoomType>(`${PROPERTY_API}/room-types`, data);
}

export async function fetchAvailability(
  roomTypeId: string,
  date: string
): Promise<Availability> {
  return apiFetch<Availability>(
    `${RATE_API}/availability?room_type_id=${roomTypeId}&date=${date}`
  );
}

export async function blockInventory(data: {
  room_type_id: string;
  date: string;
  count: number;
  action: "block" | "unblock";
}): Promise<Availability> {
  return apiPost<Availability>(`${RATE_API}/blocks`, data);
}

export async function fetchArrivals(
  hotelId: string,
  date: string
): Promise<BookingRef[]> {
  return apiFetch<BookingRef[]>(
    `${FRONT_DESK_API}/arrivals?hotel_id=${hotelId}&date=${date}`
  );
}

export async function checkInBooking(data: {
  booking_id: string;
  physical_room_number: string;
}): Promise<RoomAssignment> {
  return apiPost<RoomAssignment>(`${FRONT_DESK_API}/check-in`, data);
}

export async function checkOutBooking(bookingId: string): Promise<RoomAssignment> {
  return apiPost<RoomAssignment>(`${FRONT_DESK_API}/check-out`, {
    booking_id: bookingId,
  });
}

export async function fetchIncidents(bookingId?: string): Promise<GuestIncident[]> {
  const query = bookingId ? `?booking_id=${bookingId}` : "";
  return apiFetch<GuestIncident[]>(`${FRONT_DESK_API}/incidents${query}`);
}

export async function fetchBookingById(id: string): Promise<Booking> {
  return apiFetch<Booking>(`${BOOKING_API}/bookings/${id}`);
}

export interface BookingsQuery {
  hotel_id?: string;
  status?: "pending" | "confirmed" | "cancelled";
  date?: string;
}

export async function fetchBookings(query: BookingsQuery = {}): Promise<BookingRef[]> {
  const params = new URLSearchParams();
  if (query.hotel_id) params.set("hotel_id", query.hotel_id);
  if (query.status) params.set("status", query.status);
  if (query.date) params.set("date", query.date);
  const qs = params.toString();
  return apiFetch<BookingRef[]>(`${BOOKING_API}/bookings${qs ? `?${qs}` : ""}`);
}
