/**
 * Eventos publicados por Billing (outbox transaccional + dispatcher).
 * `billing.invoice.issued` lo consumen a futuro Loyalty/Analytics;
 * Front Desk ya lo ignora explícitamente (ver su consumer.test).
 */
export type BillingEventType = "billing.invoice.issued";

export function publishEvent(
  type: BillingEventType,
  payload: { invoice_id: string; [key: string]: unknown }
): void {
  console.log(`[events] ${type} invoice_id=${payload.invoice_id}`, payload);
}
