import Axios, {
  type AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { useSessionStore } from "../store/sessionStore";
import { env } from "./env";

export const AXIOS_INSTANCE = Axios.create({});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const { sessionId } = useSessionStore.getState();

  if (sessionId) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set(env.session_id, sessionId);
    config.headers = headers;
  }

  return config;
});

AXIOS_INSTANCE.interceptors.response.use(
  (response) => {
    const { sessionId, setSessionId } = useSessionStore.getState();

    const newSessionId = response.headers?.[env.session_id];
    if (newSessionId && newSessionId !== sessionId) {
      setSessionId(newSessionId);
    }

    return response;
  },
  (error: AxiosError<any>) => {
    return Promise.reject(error);
  },
);

export const customFetch = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const response: AxiosResponse<T> = await AXIOS_INSTANCE({
    ...config,
    ...options,
  });

  return response.data;
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
