import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-border px-5">
        <Skeleton className="size-8" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-2 w-24" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="p-6">
          <div className="mx-auto max-w-[900px]">
            <Skeleton className="mb-3 h-3 w-52" />
            <div className="rounded-md bg-[#f5eedf]/90 p-10">
              <Skeleton className="h-3 w-24 bg-[#d8cdb9]" />
              <Skeleton className="mt-3 h-8 w-64 bg-[#d8cdb9]" />
              <div className="mt-8 space-y-3">
                {[100, 96, 98, 72, 100, 90, 94, 64, 100, 86].map((width, index) => (
                  <Skeleton
                    key={index}
                    className="h-2 bg-[#ded3bf]"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-l border-border bg-[#0a0e13] p-4">
          <Skeleton className="h-7 w-36" />
          <div className="mt-6 space-y-4">
            {[100, 80, 92, 60, 88].map((width, index) => (
              <Skeleton key={index} className="h-3" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
