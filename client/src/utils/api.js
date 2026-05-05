export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const ACCESS_TOKEN_KEY = "commerce-access-token-v1";
const REFRESH_TOKEN_KEY = "commerce-refresh-token-v1";

export const authStorage = {
  getAccessToken: () =>
    localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem("accessToken"),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem("accessToken");
  },
};

const isFormData = (body) =>
  typeof FormData !== "undefined" && body instanceof FormData;

const buildHeaders = (headers = {}, body) => {
  const token = authStorage.getAccessToken();

  return {
    ...(isFormData(body) ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
};

const serializeBody = (body) => {
  if (body === undefined || body === null || isFormData(body)) return body;
  return JSON.stringify(body);
};

const readResponse = async (response) => {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");

  return isJson ? response.json() : response.text();
};

const refreshAccessToken = async () => {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    authStorage.clearTokens();
    return false;
  }

  const data = await response.json();
  authStorage.setTokens({ accessToken: data.accessToken });
  return true;
};

const request = async (path, options = {}, retry = true) => {
  const body = serializeBody(options.body);
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    body,
    headers: buildHeaders(options.headers, body),
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request(path, options, false);
  }

  const data = await readResponse(response);

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : "Request failed";
    throw new Error(message);
  }

  return data;
};

const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body, options) =>
    request(path, { method: "POST", body, ...options }),
  put: (path, body, options) =>
    request(path, { method: "PUT", body, ...options }),
  patch: (path, body, options) =>
    request(path, { method: "PATCH", body, ...options }),
  delete: (path, options) => request(path, { method: "DELETE", ...options }),
};

export default api;
