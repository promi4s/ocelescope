export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(url, { ...options, credentials: "include" });
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn("Request aborted");
      return Promise.reject(error);
    }
    throw error;
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
