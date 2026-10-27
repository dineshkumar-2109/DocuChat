// Thin fetch wrapper for the same-origin API.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let token = localStorage.getItem("token");
let onUnauthorized = () => {};

export const auth = {
  get token() { return token; },
  set(newToken) {
    token = newToken;
    if (newToken) localStorage.setItem("token", newToken);
    else localStorage.removeItem("token");
  },
  onUnauthorized(fn) { onUnauthorized = fn; },
};

export async function api(path, { method = "GET", json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  if (form) body = form;

  const res = await fetch(path, { method, headers, body });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const detail = data.details?.map((d) => d.message).join(", ");
    throw new ApiError(res.status, detail || data.error || `Request failed (${res.status})`);
  }
  return data;
}
