import { afterEach, describe, expect, it, vi } from "vitest";
import { cropDimensions, cropImageForCard } from "@/lib/image-crop";

describe("Enquadramento 9:16", () => {
  it("reduz para até 1080×1920 sem ampliar a foto", () => {
    expect(cropDimensions({ x: 0, y: 0, width: 1620, height: 2880 }, 4000, 4000)).toMatchObject({
      outWidth: 1080,
      outHeight: 1920,
    });
    expect(cropDimensions({ x: 10, y: 20, width: 400, height: 711 }, 1000, 1000)).toMatchObject({
      outWidth: 400,
      outHeight: 711,
    });
  });

  it("não deixa a área escapar pelas bordas", () => {
    expect(cropDimensions({ x: -10, y: -10, width: 5000, height: 5000 }, 1200, 1600)).toMatchObject(
      {
        x: 0,
        y: 0,
        width: 1200,
        height: 1600,
      },
    );
  });
});

describe("Geração da foto cortada", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("gera JPEG com o recorte escolhido e libera a URL temporária", async () => {
    const image = new (class {
      naturalWidth = 1000;
      naturalHeight = 1000;
      decoding = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    })();
    vi.stubGlobal("Image", function FakeImage() {
      return image;
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:foto-temporaria"),
      revokeObjectURL: vi.fn(),
    });
    const drawImage = vi.fn();
    const context = {
      drawImage,
      fillRect: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "high",
      fillStyle: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback(new Blob(["jpeg"], { type: type ?? "image/jpeg" }));
    });

    const cut = await cropImageForCard(new File(["original"], "foto.png", { type: "image/png" }), {
      x: 10,
      y: 20,
      width: 400,
      height: 711,
    });
    expect(cut.name).toBe("foto-9x16.jpg");
    expect(cut.type).toBe("image/jpeg");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-temporaria");
    expect(drawImage).toHaveBeenCalledWith(image, 10, 20, 400, 711, 0, 0, 400, 711);
  });
});
