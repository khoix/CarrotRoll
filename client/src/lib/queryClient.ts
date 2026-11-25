import { QueryClient, QueryFunction, QueryCache, MutationCache } from "@tanstack/react-query";

export const MAINTENANCE_MESSAGE = "ENOENT_MAINTENANCE";

function isMaintenanceError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if ((err as { isMaintenance?: boolean }).isMaintenance === true) return true;
  if (err.message === MAINTENANCE_MESSAGE) return true;
  if (err.message.includes("ENOENT")) return true;
  return false;
}

let maintenanceSetter: ((value: boolean) => void) | null = null;
export function registerMaintenanceSetter(setter: ((value: boolean) => void) | null) {
  maintenanceSetter = setter;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 503) {
      try {
        const body = JSON.parse(text) as { code?: string };
        if (body?.code === "ENOENT") {
          const e = new Error(MAINTENANCE_MESSAGE);
          (e as Error & { isMaintenance: boolean }).isMaintenance = true;
          throw e;
        }
      } catch (e) {
        if (isMaintenanceError(e)) throw e;
      }
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isMaintenanceError(error)) maintenanceSetter?.(true);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isMaintenanceError(error)) maintenanceSetter?.(true);
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
