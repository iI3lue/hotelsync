/**
 * Tasas impositivas simplificadas por país (BL-4).
 *
 * Alcance académico: tabla estática con las tasas generales por país.
 * La estructura (country + tax_rate guardados en la factura) ya permite
 * evolucionar a reglas fiscales completas sin cambiar el modelo.
 */
export const TAX_RATES: Record<string, number> = {
  CO: 0.19,
  AR: 0.21,
  CL: 0.19,
  MX: 0.16,
  ES: 0.21,
  US: 0,
};

export function taxRateForCountry(country: string | undefined): number {
  if (!country) return 0;
  return TAX_RATES[country.trim().toUpperCase()] ?? 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
