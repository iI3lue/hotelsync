"use client";

import { useEffect, useState } from "react";
import type { RoomType } from "@/lib/api";

export function useRoomNames(hotelId: string): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!hotelId) return;
    let cancelled = false;
    fetch(`/api/property/hotels/${encodeURIComponent(hotelId)}/room-types`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rooms: RoomType[]) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const r of rooms ?? []) map[r.room_type_id] = r.name;
        setNames(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  return names;
}
