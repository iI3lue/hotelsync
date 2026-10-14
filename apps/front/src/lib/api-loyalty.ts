// src/lib/api-loyalty.ts
"use client";

export interface LoyaltyAccount {
  account_id: string;
  user_id: string;
  tier: "silver" | "gold" | "platinum";
  points_balance: number;
  created_at: string;
  updated_at: string;
}

export interface PointsTransaction {
  transaction_id: string;
  user_id: string;
  type: "earn" | "redeem";
  points: number;
  booking_id: string | null;
  reason: string;
  created_at: string;
}

export interface MyLoyaltyResponse {
  account: LoyaltyAccount;
  recent_transactions: PointsTransaction[];
}

export interface LoyaltyTierLevel {
  name: string;
  multiplier: number;
  min_balance: number;
}

// Obtener la cuenta y transacciones del usuario logueado
export async function getMyLoyalty(): Promise<MyLoyaltyResponse> {
  const res = await fetch("/api/loyalty/me", {
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "No se pudo cargar la fidelización");
  }
  const json = await res.json();
  return json.data;
}

// Canjear puntos
export async function redeemLoyaltyPoints(points: number, reason: string): Promise<PointsTransaction> {
  const res = await fetch("/api/loyalty/me/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ points, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Error al canjear puntos");
  }
  const json = await res.json();
  return json.data;
}

// Consultar niveles y multiplicadores (público)
export async function getLoyaltyLevels(): Promise<LoyaltyTierLevel[]> {
  const res = await fetch("/api/loyalty/levels");
  if (!res.ok) throw new Error("No se pudieron cargar los niveles");
  const json = await res.json();
  return json.data;
}