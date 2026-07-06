export function buildApiUrl(baseUrl, path, params = {}) {
  const absoluteBase = baseUrl.startsWith("http")
    ? baseUrl
    : `${window.location.origin}${baseUrl}`;
  const normalizedBase = absoluteBase.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`${normalizedBase}/${normalizedPath}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

