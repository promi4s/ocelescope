import { customFetch as fetch } from "@ocelescope/api-client";
import type { AxiosRequestConfig } from "axios";

export const customFetch = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => fetch<T>(config, options);
