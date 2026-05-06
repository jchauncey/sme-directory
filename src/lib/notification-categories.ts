export const NOTIFICATION_CATEGORIES = ["question", "answer", "membership"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export function isCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function categoryFor(type: string): NotificationCategory | null {
  const head = type.split(".")[0] ?? "";
  return isCategory(head) ? head : null;
}
