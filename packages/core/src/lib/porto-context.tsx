"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PortosaurOptions } from "./config.ts";
import type { SiteIcons } from "./site-icons.ts";

/**
 * The resolved site config, available to every component below the
 * root layout. The generated root passes the config into
 * `RootLayout`, which provides it here — components read it with
 * `usePortoConfig()` instead of threading `config` through every
 * prop.
 *
 * The config object is plain JSON-serializable data (the CLI builds
 * it), so passing it through a client context boundary is safe.
 */

const PortoContext = createContext<PortosaurOptions | null>(null);

/**
 * The site's icon map, for `SiteIcon`. Empty outside the provider,
 * so icons render nothing instead of crashing.
 */
const SiteIconsContext = createContext<SiteIcons>({});

export function PortoProvider({
  config,
  icons = {},
  children,
}: {
  config: PortosaurOptions;
  icons?: SiteIcons;
  children: ReactNode;
}) {
  return (
    <PortoContext.Provider value={config}>
      <SiteIconsContext.Provider value={icons}>
        {children}
      </SiteIconsContext.Provider>
    </PortoContext.Provider>
  );
}

export function usePortoConfig(): PortosaurOptions {
  const config = useContext(PortoContext);
  if (!config) {
    throw new Error("usePortoConfig must be used within PortoProvider");
  }
  return config;
}

export function useSiteIcons(): SiteIcons {
  return useContext(SiteIconsContext);
}
