"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { es } from "react-day-picker/locale";
import { fromIsoDate, toIsoDate } from "@/components/AvailabilityCalendar";

const buttonClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-gray-900 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
const labelClass =
  "block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200";

function formatShort(iso: string): string {
  const d = fromIsoDate(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

interface DatePickerButtonProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
  id?: string;
}

export default function DatePickerButton({
  label,
  value,
  onChange,
  minDate,
  id,
}: DatePickerButtonProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = minDate ? (fromIsoDate(minDate) ?? today) : today;
  const selected = value ? fromIsoDate(value) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open ]);

  return (
    <div ref={boxRef} className="relative min-w-0">
      <span id={id ? `${id}-label` : undefined} className={labelClass}>
        {label}
      </span>
      <button
        type="button"
        id={id}
        aria-labelledby={id ? `${id}-label` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass}
      >
        {value ? formatShort(value) : "Elegir fecha…"}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute z-30 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          <DayPicker
            mode="single"
            locale={es}
            required
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toIsoDate(d));
                setOpen(false);
              }
            }}
            disabled={{ before: min }}
            captionLayout="dropdown"
            startMonth={new Date(today.getFullYear(), today.getMonth(), 1)}
            endMonth={new Date(today.getFullYear() + 1, today.getMonth(), 1)}
          />
        </div>
      ) : null}
    </div>
  );
}
