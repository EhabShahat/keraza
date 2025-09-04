// Lightweight template renderer for WhatsApp and other messages
// Replaces placeholders like {name}, {code}, {start_time}, {end_time}
// Dates are formatted as YYYY-MM-DD HH:mm (local time) for speed and consistency.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDateTime(value: Date): string {
  const y = value.getFullYear();
  const m = pad(value.getMonth() + 1);
  const d = pad(value.getDate());
  const hh = pad(value.getHours());
  const mm = pad(value.getMinutes());
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | number | Date | null | undefined>
): string {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const raw = vars[key];
    if (raw == null) return ""; // replace missing with empty to avoid leaking tokens
    if (raw instanceof Date) return formatDateTime(raw);
    // If a stringified ISO datetime is passed, try to detect and format it
    if (typeof raw === "string") {
      const maybe = new Date(raw);
      if (!isNaN(maybe.getTime()) && /\d{2}:\d{2}:?\d{0,2}/.test(raw)) {
        return formatDateTime(maybe);
      }
      return raw;
    }
    return String(raw);
  });
}
