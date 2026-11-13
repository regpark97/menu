import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Area } from "react-easy-crop";

vi.mock("react-easy-crop", () => ({
  default: ({
    aspect,
    zoom,
    onCropComplete,
  }: {
    aspect: number;
    zoom: number;
    onCropComplete: (area: Area, pixels: Area) => void;
  }) => (
    <div data-testid="cropper" data-aspect={aspect} data-zoom={zoom}>
      <button onClick={() => onCropComplete({}, { x: 0, y: 0, width: 540, height: 960 })}>
        Área mockada
      </button>
    </div>
  ),
}));

import { PhotoCropDialog } from "@/components/PhotoCropDialog";

describe("Enquadramento interativo", () => {
  it("usa 9:16, permite ajustar zoom e confirma a seleção", async () => {
    const onConfirm = vi.fn(() => Promise.resolve(true));
    const onDone = vi.fn();
    render(
      <PhotoCropDialog
        imageUrl="blob:foto"
        remaining={1}
        onCancel={() => {}}
        onDone={onDone}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByTestId("cropper")).toHaveAttribute("data-aspect", "0.5625");
    expect(screen.getByRole("button", { name: "Cortar e enviar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Área mockada" }));
    fireEvent.change(screen.getByLabelText("Zoom da foto"), { target: { value: "2.5" } });
    expect(screen.getByTestId("cropper")).toHaveAttribute("data-zoom", "2.5");
    expect(screen.getByText("250%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cortar e enviar" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onConfirm).toHaveBeenCalledWith({ x: 0, y: 0, width: 540, height: 960 });
  });

  it("permite usar o original sem chamar o recorte", async () => {
    const onUseOriginal = vi.fn(() => Promise.resolve(true));
    const onConfirm = vi.fn(() => Promise.resolve(true));
    render(
      <PhotoCropDialog
        imageUrl="blob:foto"
        remaining={1}
        onCancel={() => {}}
        onDone={() => {}}
        onConfirm={onConfirm}
        onUseOriginal={onUseOriginal}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Usar original" }));
    await waitFor(() => expect(onUseOriginal).toHaveBeenCalledOnce());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
