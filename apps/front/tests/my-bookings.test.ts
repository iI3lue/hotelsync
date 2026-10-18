import {
  checkOutIsoDate,
  isPaidBooking,
  isVisibleMyBooking,
  localIsoDate,
  visibleMyBookings,
} from "@/lib/my-bookings";

describe("localIsoDate", () => {
  it("usa la fecha local aunque esté cerca de la medianoche", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(localIsoDate(new Date(2026, 0, 6, 0, 30))).toBe("2026-01-06");
  });
});

describe("checkOutIsoDate", () => {
  it("acepta el datetime ISO que devuelve la API", () => {
    expect(checkOutIsoDate({ check_out: "2026-10-17T00:00:00.000Z" })).toBe(
      "2026-10-17"
    );
  });

  it("devuelve null cuando no hay fecha de salida", () => {
    expect(checkOutIsoDate({ check_out: null as unknown as string })).toBe(null);
  });
});

describe("isVisibleMyBooking", () => {
  it("sigue visible el día de check-out", () => {
    expect(isVisibleMyBooking({ check_out: "2026-10-17" }, "2026-10-17")).toBe(
      true
    );
  });

  it("desaparece al día siguiente del check-out", () => {
    expect(isVisibleMyBooking({ check_out: "2026-10-17" }, "2026-10-18")).toBe(
      false
    );
  });

  it("una reserva futura siempre es visible", () => {
    expect(isVisibleMyBooking({ check_out: "2026-12-01" }, "2026-10-17")).toBe(
      true
    );
  });

  it("acepta el datetime ISO que devuelve la API", () => {
    expect(
      isVisibleMyBooking({ check_out: "2026-10-17T00:00:00.000Z" }, "2026-10-17")
    ).toBe(true);
    expect(
      isVisibleMyBooking({ check_out: "2026-10-16T00:00:00.000Z" }, "2026-10-17")
    ).toBe(false);
  });

  it("oculta una reserva cancelada aunque su salida sea futura", () => {
    expect(
      isVisibleMyBooking(
        { check_out: "2026-12-01", status: "cancelled" },
        "2026-10-17"
      )
    ).toBe(false);
  });
});

describe("visibleMyBookings", () => {
  it("filtra vencidas y canceladas sin tocar las vigentes", () => {
    const list = [
      { check_out: "2026-10-15" },
      { check_out: "2026-10-17" },
      { check_out: "2026-11-01", status: "confirmed" as const },
      { check_out: "2026-11-01", status: "cancelled" as const },
    ];
    expect(visibleMyBookings(list, "2026-10-17")).toEqual([
      { check_out: "2026-10-17" },
      { check_out: "2026-11-01", status: "confirmed" },
    ]);
  });
});

describe("isPaidBooking", () => {
  it("solo PAID cuenta como pagada", () => {
    expect(isPaidBooking({ payment_status: "PAID" })).toBe(true);
    expect(isPaidBooking({ payment_status: "PENDING" })).toBe(false);
  });
});
