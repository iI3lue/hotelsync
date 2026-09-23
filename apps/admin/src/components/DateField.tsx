"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { es } from "react-day-picker/locale";

function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromIso(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

function formatShort(iso: string): string {
  const d = fromIso(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

const buttonClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-gray-900 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";

export default function DateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const selected = value ? fromIso(value) : undefined;

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

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
    <div ref={boxRef} className="relative">
      <span className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
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
                setValue(toIso(d));
                setOpen(false);
              }
            }}
            captionLayout="dropdown"
            startMonth={new Date(today.getFullYear() - 1, 0, 1)}
            endMonth={new Date(today.getFullYear() + 1, 11, 1)}
          />
        </div>
      ) : null}
    </div>
  );
}
