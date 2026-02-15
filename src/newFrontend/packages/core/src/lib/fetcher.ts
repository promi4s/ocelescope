import { client } from "@ocelescope/api-client";

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => client(url, options);
