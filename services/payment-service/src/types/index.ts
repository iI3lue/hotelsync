export type PaymentMethod = "CREDIT_CARD" | "CASH" | "TRANSFER" | "TERMINAL";
export type PaymentStatus = "COMPLETED" | "FAILED" | "REFUNDED";
export type PaymentChannel = "WEB" | "FRONT_DESK";

export interface CardInput {
  number: string;
  exp_month: number;
  exp_year: number;
  cvc: string;
  holder?: string;
}
