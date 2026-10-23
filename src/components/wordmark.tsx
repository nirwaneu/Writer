import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex size-6 items-center justify-center rounded-[4px] bg-primary text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.25)_inset]">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none">
          <path
            d="M12 3.2c2.6 2.5 4.2 5.4 4.2 8.6 0 3.2-1.9 5.7-4.2 8.9-2.3-3.2-4.2-5.7-4.2-8.9 0-3.2 1.6-6.1 4.2-8.6Z"
            fill="currentColor"
            opacity="0.92"
          />
          <path d="M12 8.4v8.2" stroke="#f2a93b" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
      {showText ? (
        <span className="font-serif text-[18px] font-semibold tracking-[-0.02em] text-foreground sm:text-[19px]">
          VibeDraft
        </span>
      ) : null}
    </span>
  );
}
