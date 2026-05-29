import { env } from "@lite/env/client";

const API_BASE_URL = `${env.NEXT_PUBLIC_BACKEND_URL}/api`;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

type ApiRequestOptions = {
  params?: QueryParams;
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

type ApiMethodOptions<TBody> = ApiRequestOptions & {
  data?: TBody;
};

function buildUrl(path: string, params?: QueryParams): string {
  const base = path.startsWith("http")
    ? new URL(path)
    : new URL(path.replace(/^\/+/, ""), `${API_BASE_URL}/`);

  if (!params) return base.toString();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    base.searchParams.set(key, String(value));
  }

  return base.toString();
}

async function request<TResponse, TBody = unknown>(
  method: string,
  path: string,
  options: ApiMethodOptions<TBody> = {},
): Promise<TResponse> {
  const { params, headers, signal, credentials, data } = options;
  const response = await fetch(buildUrl(path, params), {
    method,
    signal,
    credentials: credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const responseData = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData
        ? String((responseData as { error: unknown }).error)
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, responseData);
  }

  return responseData as TResponse;
}

export const apiClient = {
  get: <TResponse>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>("GET", path, options),

  post: <TResponse, TBody = unknown>(
    path: string,
    data?: TBody,
    options?: ApiRequestOptions,
  ) => request<TResponse, TBody>("POST", path, { ...options, data }),

  put: <TResponse, TBody = unknown>(
    path: string,
    data?: TBody,
    options?: ApiRequestOptions,
  ) => request<TResponse, TBody>("PUT", path, { ...options, data }),

  patch: <TResponse, TBody = unknown>(
    path: string,
    data?: TBody,
    options?: ApiRequestOptions,
  ) => request<TResponse, TBody>("PATCH", path, { ...options, data }),

  delete: <TResponse>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>("DELETE", path, options),
};
