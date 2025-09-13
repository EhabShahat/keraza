export function getClientIp(headers: { get(name: string): string | null | undefined } | Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const rip = headers.get("x-real-ip");
  if (rip) return rip;
  return "127.0.0.1";
}
