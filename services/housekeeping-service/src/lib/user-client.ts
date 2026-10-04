import { AppError } from "../middleware/error-handler.js";

function userServiceUrl(): string {
  return process.env.USER_SERVICE_URL || "";
}

export interface HotelStaffMember {
  user_id: string;
  email: string;
  name: string;
  assignments: Array<{
    role: string;
    hotel_id: string | null;
    is_active: boolean;
  }>;
}

/**
 * Personal activo de un hotel segun user-service. Devuelve `null` cuando
 * USER_SERVICE_URL no esta configurado (mismo patron `not_configured` del
 * broker/cache): en ese caso el llamador omite la validacion remota.
 */
export async function fetchHotelStaff(
  hotelId: string,
  authorization: string | undefined
): Promise<HotelStaffMember[] | null> {
  const baseUrl = userServiceUrl();
  if (!baseUrl) {
    console.warn(
      "[user-client] USER_SERVICE_URL no configurado: se omite la validacion contra user-service"
    );
    return null;
  }

  const res = await fetch(
    `${baseUrl}/admin/users?hotel_id=${encodeURIComponent(hotelId)}`,
    {
      headers: authorization ? { Authorization: authorization } : {},
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) {
    throw new AppError(
      502,
      "User service unavailable, cannot validate assignee",
      "Bad Gateway"
    );
  }
  return (await res.json()) as HotelStaffMember[];
}
