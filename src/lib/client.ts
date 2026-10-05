export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Thin fetch wrapper: JSON in/out, sends the user's time zone, throws ApiError with the server's message. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message ?? "Request failed.", res.status);
  return data as T;
}
