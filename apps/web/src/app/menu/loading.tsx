import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <div className="container py-12">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-12 w-72" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />

      <div className="mt-8 flex gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <div className="mt-10 grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="surface flex gap-4 p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="w-[128px] space-y-2">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
