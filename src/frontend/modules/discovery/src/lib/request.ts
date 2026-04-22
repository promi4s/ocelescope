const sessionHeader =
  `${process.env["NEXT_PUBLIC_APPLICATION_ID"] ?? "ocelescope"}-session-id`;

export const request = async <T,>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const headers = new Headers(options.headers);
  const sessionId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(sessionHeader);

  if (sessionId) {
    headers.set(sessionHeader, sessionId);
  }

  const response = await fetch(url, { ...options, headers });
  const newSessionId = response.headers.get(sessionHeader);

  if (newSessionId && typeof window !== "undefined") {
    window.localStorage.setItem(sessionHeader, newSessionId);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data !== null && "detail" in data
        ? JSON.stringify(data.detail)
        : `HTTP error ${response.status}`,
    );
  }

  return data as T;
};
