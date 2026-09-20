/**
 * Event stub — Fase 1 MVP.
 *
 * `checkout.completed` se publica como log estructurado con trazabilidad por
 * `booking_id`. En Fase 2 lo consumen Housekeeping (tarea de limpieza) y
 * Billing (cierre de folio) vía RabbitMQ, sin cambiar esta firma.
 */
export type FrontDeskEventType = "checkout.completed";

export function publishEvent(
  type: FrontDeskEventType,
  payload: { booking_id: string; [key: string]: unknown }
): void {
  console.log(`[events] ${type} booking_id=${payload.booking_id}`, payload);
}
