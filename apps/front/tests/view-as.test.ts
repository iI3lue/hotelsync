import {
  adminSectionsFor,
  defaultRouteForRole,
  isAllowedPathForRole,
  resolveViewedRole,
} from "@/lib/view-as";

describe("resolveViewedRole", () => {
  it("un SUPER_ADMIN con vista elegida ve ese rol", () => {
    expect(resolveViewedRole("SUPER_ADMIN", "GUEST")).toBe("GUEST");
    expect(resolveViewedRole("SUPER_ADMIN", "RECEPTIONIST")).toBe(
      "RECEPTIONIST"
    );
  });

  it("sin vista elegida el SUPER_ADMIN se ve a sí mismo", () => {
    expect(resolveViewedRole("SUPER_ADMIN", null)).toBe("SUPER_ADMIN");
  });

  it("un rol no-admin nunca simula: siempre se ve a sí mismo", () => {
    expect(resolveViewedRole("GUEST", "SUPER_ADMIN")).toBe("GUEST");
    expect(resolveViewedRole("RECEPTIONIST", "GUEST")).toBe("RECEPTIONIST");
  });

  it("sin sesión se asume invitado", () => {
    expect(resolveViewedRole(null, null)).toBe("GUEST");
  });
});

describe("defaultRouteForRole", () => {
  it("asigna la ruta por defecto correspondiente a cada rol", () => {
    expect(defaultRouteForRole("RECEPTIONIST")).toBe("/admin/recepcion");
    expect(defaultRouteForRole("HOUSEKEEPING")).toBe("/admin/housekeeping");
    expect(defaultRouteForRole("MANAGER")).toBe("/admin");
    expect(defaultRouteForRole("SUPER_ADMIN")).toBe("/admin");
    expect(defaultRouteForRole("GUEST")).toBe("/");
  });
});

describe("isAllowedPathForRole", () => {
  it("recepcionista solo accede a recepción y cuenta", () => {
    expect(isAllowedPathForRole("RECEPTIONIST", "/admin/recepcion")).toBe(true);
    expect(isAllowedPathForRole("RECEPTIONIST", "/cuenta/perfil")).toBe(true);
    expect(isAllowedPathForRole("RECEPTIONIST", "/")).toBe(false);
    expect(isAllowedPathForRole("RECEPTIONIST", "/admin/hotels")).toBe(false);
  });

  it("limpieza solo accede a housekeeping y cuenta", () => {
    expect(isAllowedPathForRole("HOUSEKEEPING", "/admin/housekeeping")).toBe(true);
    expect(isAllowedPathForRole("HOUSEKEEPING", "/cuenta/perfil")).toBe(true);
    expect(isAllowedPathForRole("HOUSEKEEPING", "/")).toBe(false);
    expect(isAllowedPathForRole("HOUSEKEEPING", "/admin/recepcion")).toBe(false);
  });

  it("manager accede a admin, hoteles y vista pública", () => {
    expect(isAllowedPathForRole("MANAGER", "/admin")).toBe(true);
    expect(isAllowedPathForRole("MANAGER", "/admin/hotels")).toBe(true);
    expect(isAllowedPathForRole("MANAGER", "/")).toBe(true);
    expect(isAllowedPathForRole("MANAGER", "/buscar")).toBe(true);
  });

  it("super admin accede a todo", () => {
    expect(isAllowedPathForRole("SUPER_ADMIN", "/admin")).toBe(true);
    expect(isAllowedPathForRole("SUPER_ADMIN", "/admin/recepcion")).toBe(true);
    expect(isAllowedPathForRole("SUPER_ADMIN", "/")).toBe(true);
  });
});

describe("adminSectionsFor", () => {
  it("recepcionista solo ve Recepción", () => {
    expect(adminSectionsFor("RECEPTIONIST").map((s) => s.href)).toEqual([
      "/admin/recepcion",
    ]);
  });

  it("limpieza solo ve Limpieza", () => {
    expect(adminSectionsFor("HOUSEKEEPING").map((s) => s.href)).toEqual([
      "/admin/housekeeping",
    ]);
  });

  it("manager ve Panel y Hoteles", () => {
    expect(adminSectionsFor("MANAGER").map((s) => s.href)).toEqual([
      "/admin",
      "/admin/hotels",
    ]);
  });

  it("invitado no ve secciones", () => {
    expect(adminSectionsFor("GUEST")).toEqual([]);
  });

  it("super admin ve todo", () => {
    expect(adminSectionsFor("SUPER_ADMIN")).toHaveLength(4);
  });
});
