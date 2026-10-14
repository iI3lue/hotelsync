import { z } from "zod";

const cardSchema = z.object({
  number: z.string().min(13).max(19),
  exp_month: z.number().int().min(1).max(12),
  exp_year: z.number().int().min(2024),
  cvc: z.string().regex(/^\d{3,4}$/, "CVV inválido"),
  holder: z.string().max(100).optional(),
});

// Pago web con tarjeta simulada. El monto NO viaja en el body: se verifica
// contra booking-service para que el cliente no pueda auto-fijar el precio.
export const CheckoutSchema = z.object({
  booking_id: z.string().uuid("El booking_id debe ser un UUID válido"),
  card: cardSchema,
});

// Pago manual de recepción (efectivo o datáfono físico).
export const FrontDeskPaymentSchema = z.object({
  booking_id: z.string().uuid("El booking_id debe ser un UUID válido"),
  method: z.enum(["CASH", "TRANSFER", "TERMINAL"]),
  received_by: z.string().min(1).max(100).optional(),
});
