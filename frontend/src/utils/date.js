const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatDateTime(value) {
  if (!value) {
    return "Henüz sipariş yok";
  }
  return dateTimeFormatter.format(new Date(value));
}

