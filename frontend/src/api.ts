export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.reload();
  }

  return res;
}
