export const ROUTES = {
  home: "/",
  search: "/buscar",
  login: "/cuenta/entrar",
  register: "/cuenta/crear",
  profile: "/cuenta/perfil",
  myBookings: "/mis-reservas",
  admin: "/admin",
  adminHotels: "/admin/hotels",
  adminReception: "/admin/recepcion",
  adminHousekeeping: "/admin/housekeeping",
} as const;

export function defaultRouteForRole(role: string): string {
  switch (role) {
    case "RECEPTIONIST":
      return ROUTES.adminReception;
    case "HOUSEKEEPING":
      return ROUTES.adminHousekeeping;
    case "MANAGER":
    case "SUPER_ADMIN":
      return ROUTES.admin;
    case "GUEST":
    default:
      return ROUTES.home;
  }
}

export function isAllowedPathForRole(role: string, pathname: string): boolean {
  if (!pathname.startsWith("/admin")) return true;
  if (role === "SUPER_ADMIN") return true;

  switch (role) {
    case "RECEPTIONIST":
      return pathname.startsWith(ROUTES.adminReception);
    case "HOUSEKEEPING":
      return pathname.startsWith(ROUTES.adminHousekeeping);
    case "MANAGER":
      return (
        pathname === ROUTES.admin ||
        pathname.startsWith(ROUTES.adminHotels)
      );
    default:
      return false;
  }
}
