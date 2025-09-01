import useSessionStore from "@/store/sessionStore";
import { env } from "@/util/env";

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  let response: Response;

  const { sessionId, setSessionId } = useSessionStore.getState();

  const headers = new Headers(options.headers || {});

  if (sessionId) {
    headers.set(env.oceanSessionId, sessionId);
  }

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn("Request aborted");
      return Promise.reject(error);
    }
    throw error;
  }

  const newSessionId = response.headers.get(env.oceanSessionId);
  if (newSessionId !== sessionId) {
    setSessionId(response.headers.get(env.oceanSessionId));
  }

  const contentType = response.headers.get("content-type") || "";

  let data: any;
  try {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn("Body parsing aborted");
      return Promise.reject(error);
    }
    console.error("Error parsing response body:", error);
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || `HTTP error ${response.status}`);
  }

  return data as T;
};
