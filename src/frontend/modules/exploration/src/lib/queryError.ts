export function queryErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "The query failed.";

  const response = "response" in error ? error.response : null;
  if (response && typeof response === "object" && "data" in response) {
    const data = response.data;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = data.detail;
      if (typeof detail === "string") return detail;
    }
  }
  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "The query failed.";
}
