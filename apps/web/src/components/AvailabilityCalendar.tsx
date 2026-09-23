"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { es } from "react-day-picker/locale";

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromIsoDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

function monthDays(month: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  while (d.getMonth() === month.getMonth()) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

interface AvailabilityCalendarProps {
  /** Si se pasa, cada día muestra su stock y los días sin stock se deshabilitan. */
  roomTypeId?: string;
  /** Fecha seleccionada en formato YYYY-MM-DD. */
  selected?: string;
  onSelect: (iso: string) => void;
  /** Fecha mínima elegible en formato YYYY-MM-DD (por defecto hoy). */
  minDate?: string;
  id?: string;
}

export default function AvailabilityCalendar({
  roomTypeId,
  selected,
  onSelect,
  minDate,
  id,
}: AvailabilityCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const min = minDate ? (fromIsoDate(minDate) ?? today) : today;
  const selectedDate = selected ? fromIsoDate(selected) : undefined;

  const [month, setMonth] = useState<Date>(
    () => selectedDate ?? new Date(today.getFullYear(), today.getMonth(), 1, 12)
  );
  const [stock, setStock] = useState<Record<string, number>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const cache = useRef(new Map<string, number>());

  useEffect(() => {
    if (!roomTypeId) return;
    let cancelled = false;
    const days = monthDays(month).map(toIsoDate);
    const missing = days.filter((iso) => !cache.current.has(`${roomTypeId}:${iso}`));
    if (missing.length === 0) {
      const next: Record<string, number> = {};
      for (const iso of days) next[iso] = cache.current.get(`${roomTypeId}:${iso}`) ?? 0;
      setStock(next);
      return;
    }
    setLoadingMonth(true);
    Promise.allSettled(
      missing.map(async (iso) => {
        const res = await fetch(
          `/api/rate/availability?room_type_id=${encodeURIComponent(roomTypeId)}&date=${encodeURIComponent(iso)}`
        );
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as { available?: number };
        return { iso, available: Number(data.available ?? 0) };
      })
    ).then((results) => {
      if (cancelled) return;
      for (const r of results) {
        if (r.status === "fulfilled") {
          cache.current.set(`${roomTypeId}:${r.value.iso}`, r.value.available);
        }
      }
      const next: Record<string, number> = {};
      for (const iso of days) next[iso] = cache.current.get(`${roomTypeId}:${iso}`) ?? 0;
      setStock(next);
      setLoadingMonth(false);
    });
    return () => {
      cancelled = true;
    };
  }, [roomTypeId, month]);

  const { availableDays, unavailableDays } = useMemo(() => {
    if (!roomTypeId) return { availableDays: [], unavailableDays: [] };
    const avail: Date[] = [];
    const unavail: Date[] = [];
    for (const [iso, count] of Object.entries(stock)) {
      const d = fromIsoDate(iso);
      if (!d || d < min) continue;
      if (count > 0) avail.push(d);
      else unavail.push(d);
    }
    return { availableDays: avail, unavailableDays: unavail };
  }, [stock, roomTypeId, min]);

  return (
    <div id={id}>
      <DayPicker
        mode="single"
        locale={es}
        required
        month={month}
        onMonthChange={setMonth}
        selected={selectedDate}
        onSelect={(d) => {
          if (d) onSelect(toIsoDate(d));
        }}
        disabled={[{ before: min }, ...unavailableDays]}
        modifiers={roomTypeId ? { available: availableDays } : undefined}
        modifiersClassNames={roomTypeId ? { available: "cal-available" } : undefined}
        captionLayout="dropdown"
        startMonth={new Date(today.getFullYear(), today.getMonth(), 1)}
        endMonth={new Date(today.getFullYear() + 1, today.getMonth(), 1)}
      />
      {roomTypeId ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-green-500" />
            Con disponibilidad
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            Sin disponibilidad
          </span>
          {loadingMonth ? <span>Cargando mes…</span> : null}
        </div>
      ) : null}
    </div>
  );
}
