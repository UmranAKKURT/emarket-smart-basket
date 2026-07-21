const ICON_PATHS = {
  receipt: (
    <>
      <path d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3Z" />
      <path d="M10 8h4" />
      <path d="M10 12h5" />
      <path d="M10 16h3" />
    </>
  ),
  banknote: (
    <>
      <path d="M3 7h18v10H3V7Z" />
      <path d="M7 7a3 3 0 0 1-3 3" />
      <path d="M17 17a3 3 0 0 1 3-3" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  basket: (
    <>
      <path d="M5 10h14l-1.4 8.2A2 2 0 0 1 15.6 20H8.4a2 2 0 0 1-2-1.8L5 10Z" />
      <path d="m9 10 3-6 3 6" />
      <path d="M9 14h6" />
    </>
  ),
  package: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.4 2.2 2.2 4.8-5.2" />
    </>
  ),
  trend: (
    <>
      <path d="M4 17 9 12l3 3 7-8" />
      <path d="M15 7h4v4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3 10.4 8.4 5 10l5.4 1.6L12 17l1.6-5.4L19 10l-5.4-1.6L12 3Z" />
      <path d="M5 17v3" />
      <path d="M3.5 18.5h3" />
    </>
  ),
  tag: (
    <>
      <path d="M4 4h7l9 9-7 7-9-9V4Z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
  grid: (
    <>
      <path d="M4 4h6v6H4V4Z" />
      <path d="M14 4h6v6h-6V4Z" />
      <path d="M4 14h6v6H4v-6Z" />
      <path d="M14 14h6v6h-6v-6Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <path d="M5 5h14v15H5V5Z" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M5 9h14" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V7" />
      <path d="M17 16v-8" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </>
  )
};

function AdminIcon({ name = "spark", className = "admin-svg-icon" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name] ?? ICON_PATHS.spark}
    </svg>
  );
}

export default AdminIcon;
