import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/api.js";

/**
 * The single API client. Both apps import this; neither writes a `fetch` call
 * against the API by hand, and neither declares a response interface — the
 * types come from `openapi.yaml` via `openapi-typescript`, so a breaking
 * server change fails `turbo typecheck` in CI rather than at runtime on a
 * guest's phone.
 *
 * `openapi-fetch` rather than a generated SDK class or tRPC:
 *   - It is ~2 KB and does no codegen of its own; the types are erased at
 *     build time, so the mobile bundle pays nothing.
 *   - tRPC would give a nicer DX but couples clients to the server's
 *     TypeScript. This API is also consumed by the delivery partner
 *     integration and, later, a partner ordering channel — those need a real
 *     OpenAPI contract, and maintaining both would mean two sources of truth.
 *   - Internal service-to-service calls inside the API *do* use tRPC-style
 *     typed modules; the boundary drawn here is public-vs-internal.
 */

export interface ClientOptions {
  baseUrl: string;
  /**
   * Platform-specific. Web reads an httpOnly cookie via a route handler;
   * mobile reads expo-secure-store. `@indiagate/contracts` must not know
   * which — it takes a getter.
   */
  getAccessToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void | Promise<void>;
  /** Injected so mobile can attach app/build metadata for server-side gating. */
  clientInfo?: { platform: string; appVersion: string };
}

export const createApiClient = (options: ClientOptions) => {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    headers: { "Content-Type": "application/json" },
  });

  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await options.getAccessToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      if (options.clientInfo) {
        request.headers.set(
          "X-Client",
          `${options.clientInfo.platform}/${options.clientInfo.appVersion}`,
        );
      }
      return request;
    },
    async onResponse({ response }) {
      if (response.status === 401) await options.onUnauthorized?.();
      return response;
    },
  };

  client.use(auth);
  return client;
};

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Every mutating call that creates money or capacity needs one of these.
 * Generated once per user *intent*, not per retry — the whole point is that a
 * retry reuses the key. React Query's `mutationFn` closes over a key created
 * in `onMutate`, so an automatic retry sends the same one.
 */
export const newIdempotencyKey = (): string =>
  globalThis.crypto.randomUUID();
