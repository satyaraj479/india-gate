import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { ApiClient } from "@indiagate/contracts/client";
import { newIdempotencyKey } from "@indiagate/contracts/client";
import { useApi } from "./provider.js";

/**
 * Shared server-state layer.
 *
 * This is where most of the real cross-platform reuse lives — not in
 * components. Cache keys, staleness policy, optimistic updates, retry
 * behaviour and error mapping are identical on web and mobile, and they are
 * the parts that are subtle and easy to get inconsistently wrong. A pixel of
 * padding differing between platforms is fine; a cache key differing is a bug
 * that only shows up as a stale menu after an outlet 86s an item.
 */

export const cateringKeys = {
  all: ["catering"] as const,
  packages: (filters: Record<string, unknown>) =>
    [...cateringKeys.all, "packages", filters] as const,
  package: (id: string) => [...cateringKeys.all, "package", id] as const,
  availability: (id: string, from: string, to: string, pax?: number) =>
    [...cateringKeys.all, "availability", id, from, to, pax ?? null] as const,
  quote: (input: unknown) => [...cateringKeys.all, "quote", input] as const,
};

export const useCateringPackage = (
  packageId: string,
  options?: Partial<UseQueryOptions>,
) => {
  const api = useApi();
  return useQuery({
    queryKey: cateringKeys.package(packageId),
    queryFn: async () => {
      const { data, error } = await api.GET("/catering/packages/{packageId}", {
        params: { path: { packageId } },
      });
      if (error) throw error;
      return data;
    },
    // Package definitions change on the order of weeks. Long stale time keeps
    // the wizard instant when the guest steps backwards.
    staleTime: 10 * 60_000,
    ...options,
  });
};

/**
 * The running total under the wizard.
 *
 * Deliberately a server call rather than running `quoteCatering` from
 * `@indiagate/core` on the device, even though that function exists and would
 * be instant. Reason: the server also applies coupons, outlet-specific
 * surcharges and date-based pricing that the client does not have, and a
 * footer total that differs from the checkout total by two dollars destroys
 * trust in the whole flow.
 *
 * `@indiagate/core` is still used on the client — for the *validation* half
 * (has this course got enough picks, is the Next button enabled), which needs
 * to be instant and has no server-only inputs. Split by what the client can
 * know, not by what is convenient.
 */
export const useCateringQuote = (
  input: {
    packageId: string;
    pax: number;
    selections: Array<{ courseId: string; optionIds: string[] }>;
    addOns?: Array<{ addOnId: string; quantity: number }>;
    staffCount?: number;
    couponCode?: string;
  },
  enabled = true,
) => {
  const api = useApi();
  return useQuery({
    queryKey: cateringKeys.quote(input),
    queryFn: async () => {
      const { data, error } = await api.POST("/catering/quote", { body: input });
      if (error) throw error;
      return data;
    },
    enabled: enabled && input.pax > 0,
    // Keep the previous total on screen while the next one loads, so the
    // footer does not flash a skeleton on every tap.
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: 1,
  });
};

export const useCreateCateringBooking = () => {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    // Created once per attempt and closed over, so React Query's retries and
    // a user's double-tap both reuse it. Generating it inside mutationFn
    // would defeat the entire mechanism.
    mutationFn: async (vars: {
      body: unknown;
      idempotencyKey?: string;
    }) => {
      const { data, error } = await api.POST("/catering/bookings", {
        body: vars.body as never,
        params: {
          header: { "Idempotency-Key": vars.idempotencyKey ?? newIdempotencyKey() },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cateringKeys.all });
    },
  });
};

export type { ApiClient };
