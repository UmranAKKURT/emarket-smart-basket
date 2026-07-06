import { buildApiUrl } from "../utils/apiUrl.js";

async function readJson(response, ignoreInvalidJson) {
  try {
    if (typeof response.text === "function") {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    return typeof response.json === "function" ? await response.json() : null;
  } catch (error) {
    if (ignoreInvalidJson) {
      return null;
    }
    throw new Error("Sunucudan beklenmeyen bir yanıt alındı.", {
      cause: error
    });
  }
}

export async function requestJson(path, options) {
  const {
    baseUrl,
    method = "GET",
    params,
    headers,
    body,
    signal,
    credentials,
    defaultErrorMessage,
    resolveErrorMessage,
    ignoreInvalidJson = false
  } = options;

  let response;
  try {
    response = await fetch(buildApiUrl(baseUrl, path, params), {
      method,
      credentials,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new Error(
      "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.",
      { cause: error }
    );
  }
  const data = await readJson(response, ignoreInvalidJson);

  if (!response.ok) {
    const error = new Error(
      resolveErrorMessage?.(data) || defaultErrorMessage
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
