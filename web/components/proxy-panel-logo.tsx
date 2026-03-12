import Image from "next/image";

import { cn } from "@/lib/utils";

type ProxyPanelLogoProps = {
  className?: string;
  imageClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
  priority?: boolean;
  size?: number;
};

export function ProxyPanelLogo({
  className,
  imageClassName,
  labelClassName,
  showLabel = true,
  priority = false,
  size = 32,
}: ProxyPanelLogoProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/proxy-panel-logo.svg"
        alt="Proxy Panel"
        width={size}
        height={size}
        priority={priority}
        className={cn("shrink-0 rounded-lg", imageClassName)}
      />
      {showLabel ? <span className={cn("truncate font-semibold", labelClassName)}>Proxy Panel</span> : null}
    </span>
  );
}