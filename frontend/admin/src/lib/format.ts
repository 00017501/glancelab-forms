export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The server sends UTC; times without a zone are read as UTC, then shown in the admin's local time. */
export function formatDateTime(iso: string): string {
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  return dateTime.format(new Date(withZone));
}

export function formatDate(isoDate: string): string {
  return dateOnly.format(new Date(`${isoDate}T00:00:00`));
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const whole = Math.round(seconds);
  return whole < 60 ? `${whole} s` : `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, "0")} s`;
}

/** Colours for variant tiles, in the order variants are created. Text colour is chosen for contrast. */
export const VARIANT_COLOURS: { background: string; text: string }[] = [
  { background: "#444ce7", text: "#ffffff" },
  { background: "#ffce3a", text: "#141414" },
  { background: "#59fda0", text: "#141414" },
  { background: "#ff6b5e", text: "#141414" },
  { background: "#b664ff", text: "#141414" },
  { background: "#ff9a2e", text: "#141414" },
  { background: "#ff6ff2", text: "#141414" },
  { background: "#2a7c95", text: "#ffffff" },
];

export function variantColour(index: number): { background: string; text: string } {
  return VARIANT_COLOURS[index % VARIANT_COLOURS.length]!;
}
