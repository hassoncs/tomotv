import { videoPlayerReducer, VideoPlayerState } from "../useVideoPlayback";

describe("videoPlayerReducer", () => {
  const baseDetails = {
    Id: "1",
    Name: "Example",
  } as any;

  it("moves through happy-path states", () => {
    let state: VideoPlayerState = { type: "IDLE" };

    state = videoPlayerReducer(state, { type: "FETCH_METADATA" });
    expect(state).toEqual({ type: "FETCHING_METADATA" });

    state = videoPlayerReducer(state, {
      type: "METADATA_FETCHED",
      details: baseDetails,
      mode: "direct",
      hasSubtitles: false,
    });
    expect(state.type).toBe("CREATING_STREAM");

    state = videoPlayerReducer(state, {
      type: "STREAM_CREATED",
      streamUrl: "https://example/video",
    });
    expect(state).toEqual({ type: "INITIALIZING_PLAYER", mode: "direct", streamUrl: "https://example/video" });

    state = videoPlayerReducer(state, { type: "PLAYER_READY" });
    expect(state).toEqual({ type: "READY", mode: "direct" });

    state = videoPlayerReducer(state, { type: "PLAYER_PLAYING" });
    expect(state).toEqual({ type: "PLAYING", mode: "direct" });
  });

  it("surfaces retry flag when direct play fails before transcoding", () => {
    const errorState = videoPlayerReducer(
      { type: "CREATING_STREAM", mode: "direct", details: baseDetails, hasSubtitles: false },
      {
        type: "PLAYER_ERROR",
        error: { message: "codec not supported" },
        mode: "direct",
        hasTriedTranscode: false,
      },
    );

    expect(errorState).toEqual({
      type: "ERROR",
      error: "codec not supported",
      canRetryWithTranscode: true,
    });
  });

  it("stays in error without retry when already transcoding", () => {
    const errorState = videoPlayerReducer(
      { type: "READY", mode: "transcode" },
      {
        type: "PLAYER_ERROR",
        error: { message: "transcode server down" },
        mode: "transcode",
        hasTriedTranscode: true,
      },
    );

    expect(errorState).toEqual({
      type: "ERROR",
      error: "transcode server down",
      canRetryWithTranscode: false,
    });
  });
});
