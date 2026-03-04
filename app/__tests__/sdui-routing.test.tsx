/**
 * Verifies SDUI rendering:
 * - All components render to the AI tab canvas
 * - navigateToTab flag is correctly threaded through
 */
import React from "react";

import { componentRegistry } from "@/services/componentRegistry";
import "@/components/sdui/registerComponents";

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

describe("SDUI rendering", () => {
  beforeEach(() => {
    componentRegistry.drainPending();
  });

  it("dispatchRender delivers payload to listeners", () => {
    const received: string[] = [];
    const unsub = componentRegistry.onRender((p) => {
      received.push(p.name);
    });

    componentRegistry.dispatchRender("NowPlayingCard", { title: "Test" });
    expect(received).toContain("NowPlayingCard");
    unsub();
  });

  it("navigateToTab defaults to true", () => {
    const payloads: { navigateToTab: boolean }[] = [];
    const unsub = componentRegistry.onRender((p) => payloads.push(p));
    componentRegistry.dispatchRender("ChatMessage", { text: "hi" });
    expect(payloads[0].navigateToTab).toBe(true);
    unsub();
  });

  it("navigateToTab=false is preserved", () => {
    const payloads: { navigateToTab: boolean }[] = [];
    const unsub = componentRegistry.onRender((p) => payloads.push(p));
    componentRegistry.dispatchRender("ChatMessage", { text: "hi" }, { navigateToTab: false });
    expect(payloads[0].navigateToTab).toBe(false);
    unsub();
  });
});
