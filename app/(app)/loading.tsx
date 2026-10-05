import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <li className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-6 w-20" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-12" />
      </div>
    </li>
  );
}

export default function Loading() {
  return (
    <div role="status" aria-label="Loading orders">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="mb-4 h-16 rounded-2xl" />
      <ul className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
