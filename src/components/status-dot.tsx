import { cn } from "@/lib/utils";

export function StatusDot({
  tone = "muted",
  pulse = false,
  className,
}: {
  tone?: "amber" | "success" | "danger" | "muted";
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === "amber"
      ? "bg-primary"
      : tone === "success"
        ? "bg-[#86bd93]"
        : tone === "danger"
          ? "bg-destructive"
          : "bg-muted-foreground/60";
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        color,
        pulse && "animate-pulse-dot",
        className,
      )}
    />
  );
}
