import { z } from "zod";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-preferences";

const categoryEnum = z.enum(
  NOTIFICATION_CATEGORIES as unknown as [string, ...string[]],
);

export const updateNotificationPreferenceSchema = z.object({
  mutedTypes: z.array(categoryEnum).max(NOTIFICATION_CATEGORIES.length),
});

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;
