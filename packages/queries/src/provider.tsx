import { createContext, useContext, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiClient } from "@indiagate/contracts/client";

/**
 * One provider, two hosts.
 *
 * The client instance itself is constructed per platform (different token
 * storage, different base URL resolution, different persistence adapter) and
 * injected. Everything downstream — every hook in this package — is
 * platform-agnostic.
 */

const ApiContext = createContext<ApiClient | null>(null);

export const useApi = (): ApiClient => {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside <DataProvider>");
  return client;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Mobile users are on hotel wifi and MRT tunnels; web users are not.
        // These defaults suit both because they are conservative: refetch on
        // reconnect, never on window focus (which fires constantly on iOS).
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          // Never retry a 4xx: a rejected coupon or a filled slot will not
          // succeed on the second attempt, and retrying a 409 on checkout is
          // actively harmful.
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        // Mutations carry idempotency keys, so a network-level retry is safe.
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status && status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });

export const DataProvider = ({
  client,
  queryClient,
  children,
}: {
  client: ApiClient;
  queryClient?: QueryClient;
  children: ReactNode;
}) => {
  const qc = useMemo(() => queryClient ?? createQueryClient(), [queryClient]);
  return (
    <ApiContext.Provider value={client}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
};
