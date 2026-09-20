import { z } from "zod";

export const availabilityQuerySchema = z.object({
  room_type_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
