import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Tables } from "@/integrations/supabase/types";

const mocks = vi.hoisted(() => ({ update: vi.fn(), fetch: vi.fn() }));

vi.stubGlobal("fetch", mocks.fetch);
vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

afterEach(() => vi.restoreAllMocks());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {};
      query.update = (data: unknown) => {
        mocks.update(data);
        return query;
      };
      query.eq = () => query;
      query.select = () => query;
      query.single = async () => ({ data: { moderation_status: "pending" } });
      return query;
    },
  },
}));
vi.mock("@/lib/media", () => ({
  uploadMedia: async (file: File) => ({
    url: file.name,
    type: file.type.startsWith("video/") ? "video" : "image",
  }),
}));

vi.mock("@/lib/image-crop", () => ({
  cropImageForCard: async (file: File) =>
    new File([file], `${file.name.replace(/\.[^.]+$/, "")}-9x16.jpg`, { type: "image/jpeg" }),
}));
vi.mock("@/components/PhotoCropDialog", () => ({
  PhotoCropDialog: ({
    onConfirm,
    onDone,
  }: {
    onConfirm: (pixels: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => Promise<boolean>;
    onDone: () => void;
  }) => (
    <button
      onClick={() =>
        void onConfirm({ x: 0, y: 0, width: 100, height: 178 }).then((saved) => {
          if (saved) onDone();
        })
      }
    >
      Aplicar recorte 9:16
    </button>
  ),
}));

import { ProductGalleryEditor } from "@/components/ProductGalleryEditor";

const product = {
  id: "prato-1",
  tenant_id: "tenant-1",
  media_url: "capa-atual.mp4",
  media_type: "video",
  pending_media_url: null,
  pending_media_type: null,
  media_gallery: [],
  pending_media_gallery: [{ url: "extra-1.jpg", type: "image" }],
  moderation_status: "pending",
} as Tables<"products">;

function renderEditor(overrides: Partial<Tables<"products">> = {}) {
  const base = { ...product, ...overrides };
  const view = render(
    <ProductGalleryEditor
      product={base}
      onChange={() => {
        const patch = mocks.update.mock.lastCall?.[0] as Partial<Tables<"products">> | undefined;
        if (patch)
          view.rerender(
            <ProductGalleryEditor product={{ ...base, ...patch }} onChange={() => {}} />,
          );
      }}
    />,
  );
  return view;
}

describe("Editor unificado de fotos", () => {
  it("não perde os arquivos ao limpar um FileList vivo antes do upload", async () => {
    const { container } = renderEditor({ media_url: null, pending_media_gallery: [] });
    const input = container.querySelector('input[type="file"]')!;
    let live = true;
    const selected = [new File(["foto"], "iphone.jpg", { type: "image/jpeg" })];
    Object.defineProperty(input, "files", {
      configurable: true,
      get: () => ({
        get length() {
          return live ? selected.length : 0;
        },
        *[Symbol.iterator]() {
          yield* selected;
        },
      }),
    });
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "",
      set: () => {
        live = false;
      },
    });

    fireEvent.change(input);
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar recorte 9:16" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ pending_media_url: "iphone-9x16.jpg" }),
    );
  });
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.fetch.mockReset().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["foto"], { type: "image/jpeg" }),
    });
  });

  it("envia a foto escolhida para a fila como capa, preservando as outras", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Usar como capa" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({
      pending_media_url: "extra-1.jpg",
      pending_media_type: "image",
      pending_media_gallery: [],
      moderation_status: "pending",
    });
  });

  it("mantém a galeria vazia na tela ao remover a última extra", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Remover foto 2" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ pending_media_gallery: [] }),
    );
    expect(screen.queryByRole("button", { name: "Remover foto 2" })).not.toBeInTheDocument();
  });

  it("escolhe capa só ao enviar foto num produto ainda sem mídia", async () => {
    const { container } = renderEditor({ media_url: null, pending_media_gallery: [] });
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [
          new File(["a"], "primeira.jpg", { type: "image/jpeg" }),
          new File(["b"], "segunda.mp4", { type: "video/mp4" }),
        ],
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar recorte 9:16" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update).toHaveBeenLastCalledWith({
      pending_media_url: "primeira-9x16.jpg",
      pending_media_type: "image",
      pending_media_gallery: [{ url: "segunda.mp4", type: "video" }],
      moderation_status: "pending",
    });
  });

  it("reenquadra uma extra sem mudar a capa ou a ordem das demais", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cortar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar recorte 9:16" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({
      pending_media_url: "capa-atual.mp4",
      pending_media_type: "video",
      pending_media_gallery: [{ url: "foto-original-9x16.jpg", type: "image" }],
      moderation_status: "pending",
    });
  });

  it("substitui uma capa publicada após o recorte, preservando as extras", async () => {
    renderEditor({ media_url: "capa-atual.jpg", media_type: "image" });
    fireEvent.click(screen.getAllByRole("button", { name: "Cortar" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar recorte 9:16" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({
      pending_media_url: "foto-original-9x16.jpg",
      pending_media_type: "image",
      pending_media_gallery: [{ url: "extra-1.jpg", type: "image" }],
      moderation_status: "pending",
    });
  });
});
