import { expect, test, describe } from "bun:test";
import {
  holdInstallPrompt,
  serviceWorkerUrl,
  shouldRegisterServiceWorker,
  takeInstallPrompt,
  type BeforeInstallPromptEvent,
} from "../src/lib/service-worker.ts";

describe("shouldRegisterServiceWorker", () => {
  test("registers when enabled in production", () => {
    expect(
      shouldRegisterServiceWorker(
        { site: { pwa: { enable: true } } },
        "production",
      ),
    ).toBe(true);
  });

  test("the PWA switch defaults to on", () => {
    expect(shouldRegisterServiceWorker({}, "production")).toBe(true);
    expect(shouldRegisterServiceWorker({ site: {} }, "production")).toBe(true);
    expect(
      shouldRegisterServiceWorker({ site: { pwa: {} } }, "production"),
    ).toBe(true);
  });

  test("never registers when disabled", () => {
    expect(
      shouldRegisterServiceWorker(
        { site: { pwa: { enable: false } } },
        "production",
      ),
    ).toBe(false);
  });

  test("never registers outside production", () => {
    expect(
      shouldRegisterServiceWorker(
        { site: { pwa: { enable: true } } },
        "development",
      ),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({ site: { pwa: { enable: true } } }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({ site: { pwa: { enable: true } } }, "test"),
    ).toBe(false);
  });
});

describe("serviceWorkerUrl", () => {
  test("is /sw.js at the site root", () => {
    expect(serviceWorkerUrl("/")).toBe("/sw.js");
    expect(serviceWorkerUrl()).toBe("/sw.js");
  });

  test("is base-prefixed on a based site", () => {
    expect(serviceWorkerUrl("/porto-astro/")).toBe("/porto-astro/sw.js");
    expect(serviceWorkerUrl("/porto-astro")).toBe("/porto-astro/sw.js");
  });
});

describe("held install prompt", () => {
  function fakePrompt() {
    let prevented = false;
    const event = {
      preventDefault: () => {
        prevented = true;
      },
      platforms: ["web"],
      userChoice: Promise.resolve({
        outcome: "accepted",
        platform: "web",
      }),
      prompt: async () => {},
    } as unknown as BeforeInstallPromptEvent;
    return { event, prevented: () => prevented };
  }

  test("take returns null when nothing was offered", () => {
    expect(takeInstallPrompt()).toBeNull();
  });

  test("hold stores the prompt and take clears it", () => {
    const { event, prevented } = fakePrompt();
    holdInstallPrompt(event);
    expect(prevented()).toBe(true);
    expect(takeInstallPrompt()).toBe(event);
    expect(takeInstallPrompt()).toBeNull();
  });
});
