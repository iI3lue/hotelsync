export interface BookingDetails {
  booking_id: string;
  status: string;
  total_amount: number | string;
}

export async function getBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const url = `${process.env.BOOKING_SERVICE_URL}/bookings/${bookingId}`;
  const res = await fetch(url, {
    headers: { "x-service-key": process.env.BOOKING_SERVICE_KEY || "" },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw Object.assign(new Error("Booking fetch failed"), { status: res.status });
  }
  return (await res.json()) as BookingDetails;
}
