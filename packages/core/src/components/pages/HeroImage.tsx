"use client";

/**
 * The docs-home hero image — a tiny client component because the
 * `onError` fallback swap needs an event handler, which server
 * components can't have. On load failure (and only once — the
 * handler clears itself first) the image swaps to the fallback
 * source.
 */
export function HeroImage({
  src,
  fallback,
  width,
  height,
  alt = "Hero",
}: {
  src: string;
  fallback?: string;
  width?: number;
  height?: number;
  alt?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      fetchPriority="high"
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
