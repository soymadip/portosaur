"use client";

/**
 * The docs-home hero image — a tiny client component because the
 * `onError` fallback swap needs an event handler, which server
 * components can't have. On load failure (and only once — the
 * handler clears itself first) the image swaps to the fallback
 * source. Above-the-fold images load eagerly at high priority;
 * below-the-fold ones (the About photo) pass `priority={false}`
 * and load lazily instead, so they never compete with the hero
 * for bandwidth on a slow connection.
 */
export function HeroImage({
  src,
  fallback,
  width,
  height,
  alt = "Hero",
  priority = true,
}: {
  src: string;
  fallback?: string;
  width?: number;
  height?: number;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      width={width ?? 400}
      height={height ?? 400}
      onError={
        fallback
          ? (event) => {
              const img = event.currentTarget;
              img.onerror = null;
              img.src = fallback;
            }
          : undefined
      }
    />
  );
}
