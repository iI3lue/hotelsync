"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAvailability } from "./api-client";

const CONCURRENCY = 6;

/** Caché compartida entre todos los calendarios de la página. */
const sharedCache = new Map<string, number>();
/** Deduplica fetches concurrentes del mismo día. */
const inflight = new Map<string, Promise<number>>();

export function toMonthDays(year: number, monthIndex: number): string[] {
  const days: string[] = [];
  const d = new Date(year, monthIndex, 1, 12);
  while (d.getMonth() === monthIndex) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${d.getFullYear()}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fetchDay(roomTypeId: string, iso: string): Promise<number> {
  const key = `${roomTypeId}:${iso}`;
  const hit = sharedCache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;
  const p = fetchAvailability(roomTypeId, iso)
    .then((data) => {
      const n = Number(data.available ?? 0);
      sharedCache.set(key, n);
      return n;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** Precarga un mes en background (los días ya cacheados se saltean). */
export function prefetchMonth(
  roomTypeId: string,
  year: number,
  monthIndex: number
): void {
  const run = () => {
    for (const iso of toMonthDays(year, monthIndex)) {
      const key = `${roomTypeId}:${iso}`;
      if (!sharedCache.has(key) && !inflight.has(key)) {
        fetchDay(roomTypeId, iso).catch(() => undefined);
      }
    }
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  } else {
    setTimeout(run, 0);
  }
}

/**
 * Stock del mes para pintar el calendario, con caché compartida entre
 * calendarios, concurrencia acotada y cancelación al navegar rápido.
 */
export function useMonthAvailability(
  roomTypeId: string | undefined,
  year: number,
  monthIndex: number
): { stock: Record<string, number>; loading: boolean } {
  const [stock, setStock] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!roomTypeId) {
      setStock({});
      setLoading(false);
      return;
    }
    const my = ++seq.current;
    let cancelled = false;
    const days = toMonthDays(year, monthIndex);

    const next: Record<string, number> = {};
    const missing: string[] = [];
    for (const iso of days) {
      const hit = sharedCache.get(`${roomTypeId}:${iso}`);
      if (hit !== undefined) next[iso] = hit;
      else missing.push(iso);
    }
    // Pinta al instante lo cacheado (incluye lo del otro calendario).
    if (my === seq.current) setStock(next);
    if (missing.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let i = 0;
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, missing.length) },
      async () => {
        while (!cancelled && i < missing.length) {
          const iso = missing[i++];
          try {
            const n = await fetchDay(roomTypeId, iso);
            if (!cancelled && my === seq.current) {
              setStock((prev) => (prev[iso] === n ? prev : { ...prev, [iso]: n }));
            }
          } catch {
            // El día queda sin pintar; se reintenta al volver al mes.
          }
        }
      }
    );
    void Promise.all(workers).then(() => {
      if (!cancelled && my === seq.current) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [roomTypeId, year, monthIndex]);

  return { stock, loading };
}
