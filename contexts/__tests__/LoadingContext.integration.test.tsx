import React, { forwardRef, useImperativeHandle } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LoadingProvider, useLoading } from "../LoadingContext";

type LoadingHandle = {
  show: () => void;
  hide: () => void;
  currentValue: () => boolean;
};

const LoadingHarness = forwardRef<LoadingHandle>((_, ref) => {
  const loading = useLoading();

  useImperativeHandle(
    ref,
    () => ({
      show: loading.showGlobalLoader,
      hide: loading.hideGlobalLoader,
      currentValue: () => loading.isLoading,
    }),
    [loading],
  );

  return null;
});
LoadingHarness.displayName = "LoadingHarness";

describe("LoadingProvider", () => {
  let testRenderer: TestRenderer.ReactTestRenderer;
  const harnessRef = React.createRef<LoadingHandle>();

  beforeEach(() => {
    act(() => {
      testRenderer = TestRenderer.create(
        <LoadingProvider>
          <LoadingHarness ref={harnessRef} />
        </LoadingProvider>,
      );
    });
  });

  afterEach(() => {
    testRenderer.unmount();
  });

  it("toggles loading state via context actions", () => {
    expect(harnessRef.current?.currentValue()).toBe(false);

    act(() => {
      harnessRef.current?.show();
    });
    expect(harnessRef.current?.currentValue()).toBe(true);

    act(() => {
      harnessRef.current?.hide();
    });
    expect(harnessRef.current?.currentValue()).toBe(false);
  });

  it("is idempotent when calling show/hide repeatedly", () => {
    act(() => {
      harnessRef.current?.show();
      harnessRef.current?.show();
    });
    expect(harnessRef.current?.currentValue()).toBe(true);

    act(() => {
      harnessRef.current?.hide();
      harnessRef.current?.hide();
    });
    expect(harnessRef.current?.currentValue()).toBe(false);
  });
});
