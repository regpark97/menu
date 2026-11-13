import { describe, expect, it, vi } from "vitest";
import { syncMenuVideoPlayback } from "@/lib/menu-video";

describe("Reprodução dos vídeos do cardápio", () => {
  it("recomeça do zero e toca quando o prato entra em foco", () => {
    const video = {
      currentTime: 38,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    } as unknown as HTMLVideoElement;

    syncMenuVideoPlayback(video, true);

    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalledOnce();
    expect(video.pause).not.toHaveBeenCalled();
  });

  it("pausa ao sair do foco sem tocar o tempo atual", () => {
    const video = {
      currentTime: 38,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    } as unknown as HTMLVideoElement;

    syncMenuVideoPlayback(video, false);

    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.play).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(38);
  });
});
