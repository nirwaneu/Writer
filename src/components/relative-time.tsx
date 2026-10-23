"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatDate, formatRelative } from "@/lib/utils";

export function RelativeTime({
  value,
  className,
}: {
  value: string | Date;
  className?: string;
}) {
  const [label, setLabel] = useState(() => formatDate(value));

  useEffect(() => {
    const update = () => setLabel(formatRelative(value));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}

const emptySubscribe = () => () => undefined;

export function LocalTime({
  value,
  className,
}: {
  value: string | Date;
  className?: string;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <span className={className} suppressHydrationWarning />;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))}
    </span>
  );
}
