import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Tables } from "@/integrations/supabase/types";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));

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
  return render(
    <ProductGalleryEditor product={{ ...product, ...overrides }} onChange={() => {}} />,
  );
}

describe("Editor unificado de fotos", () => {
  beforeEach(() => mocks.update.mockClear());

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
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({
      pending_media_url: "primeira.jpg",
      pending_media_type: "image",
      pending_media_gallery: [{ url: "segunda.mp4", type: "video" }],
      moderation_status: "pending",
    });
  });
});
