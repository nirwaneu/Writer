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
            d="M4 20.2 5.2 16 15.8 5.4a2.25 2.25 0 0 1 3.2 3.2L8.4 19.2 4 20.2Z"
            fill="currentColor"
          />
          <path
            d="m14.6 6.6 3.2 3.2"
            stroke="#f2a93b"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="m5.2 16 3.2 3.2"
            stroke="#f2a93b"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.7"
          />
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
