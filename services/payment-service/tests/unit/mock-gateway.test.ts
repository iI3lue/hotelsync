import { authorizeCard, expiryValid, luhnValid } from "../../src/lib/mock-gateway";

describe("mock-gateway (pasarela simulada)", () => {
  test("Luhn acepta la tarjeta de prueba que autoriza", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
  });

  test("Luhn rechaza un número inválido", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
  });

  test("expiry rechaza tarjeta vencida", () => {
    expect(expiryValid(1, 2020, new Date("2026-10-14"))).toBe(false);
    expect(expiryValid(12, 2030, new Date("2026-10-14"))).toBe(true);
  });

  test("autoriza la tarjeta de prueba con monto válido", () => {
    const res = authorizeCard(
      { number: "4111111111111111", exp_month: 12, exp_year: 2030, cvc: "123" },
      850000
    );
    expect(res.authorized).toBe(true);
    expect(res.auth_code).toMatch(/^MOCK-/);
  });

  test("rechaza la tarjeta de prueba de banco (simulado)", () => {
    const res = authorizeCard(
      { number: "4000000000000002", exp_month: 12, exp_year: 2030, cvc: "123" },
      850000
    );
    expect(res.authorized).toBe(false);
  });
});
