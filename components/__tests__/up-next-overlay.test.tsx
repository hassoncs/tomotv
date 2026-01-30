import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { UpNextOverlay } from "../up-next-overlay";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("UpNextOverlay", () => {
  const defaultProps = {
    nextVideoName: "Episode 2 - The Return",
    progress: "1 of 10",
    onSkip: jest.fn(),
    visible: true,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders when visible", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<UpNextOverlay {...defaultProps} />);
    });
    const tree = renderer!.toJSON();
    expect(tree).not.toBeNull();
    renderer!.unmount();
  });

  it("returns null when not visible", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <UpNextOverlay {...defaultProps} visible={false} />
      );
    });
    const tree = renderer!.toJSON();
    expect(tree).toBeNull();
    renderer!.unmount();
  });

  it("displays the next video name", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<UpNextOverlay {...defaultProps} />);
    });
    const root = renderer!.root;

    const textNodes = root.findAllByType("Text" as any);
    const names = textNodes.map((t) => {
      try {
        return t.props.children;
      } catch {
        return null;
      }
    });

    expect(names).toContain("Episode 2 - The Return");
    renderer!.unmount();
  });

  it("displays progress text", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<UpNextOverlay {...defaultProps} />);
    });
    const root = renderer!.root;

    const textNodes = root.findAllByType("Text" as any);
    const texts = textNodes.map((t) => {
      try {
        return t.props.children;
      } catch {
        return null;
      }
    });

    expect(texts).toContain("1 of 10");
    renderer!.unmount();
  });

  it("counts down from 30 to 0", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<UpNextOverlay {...defaultProps} />);
    });
    const root = renderer!.root;

    const findCountdown = () => {
      const textNodes = root.findAllByType("Text" as any);
      return textNodes.find((t) => {
        try {
          const children = t.props.children;
          return typeof children === "string" && children.endsWith("s");
        } catch {
          return false;
        }
      });
    };

    expect(findCountdown()?.props.children).toBe("30s");

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(findCountdown()?.props.children).toBe("27s");

    renderer!.unmount();
  });

  it("auto-skips when countdown reaches 0", () => {
    const onSkip = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <UpNextOverlay {...defaultProps} onSkip={onSkip} />
      );
    });

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    renderer!.unmount();
  });

  it("resets countdown when visibility changes", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <UpNextOverlay {...defaultProps} visible={false} />
      );
    });

    act(() => {
      renderer!.update(<UpNextOverlay {...defaultProps} visible={true} />);
    });

    // Advance 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Hide and show again
    act(() => {
      renderer!.update(<UpNextOverlay {...defaultProps} visible={false} />);
    });
    act(() => {
      renderer!.update(<UpNextOverlay {...defaultProps} visible={true} />);
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType("Text" as any);
    const countdown = textNodes.find((t) => {
      try {
        const children = t.props.children;
        return typeof children === "string" && children.endsWith("s");
      } catch {
        return false;
      }
    });

    expect(countdown?.props.children).toBe("30s");

    renderer!.unmount();
  });

  it("does not render progress text when empty", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <UpNextOverlay {...defaultProps} progress="" />
      );
    });
    const root = renderer!.root;

    const textNodes = root.findAllByType("Text" as any);
    const progressNode = textNodes.find((t) => {
      try {
        return t.props.children === "";
      } catch {
        return false;
      }
    });

    expect(progressNode).toBeUndefined();
    renderer!.unmount();
  });
});
