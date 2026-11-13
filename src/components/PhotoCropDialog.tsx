import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { ZoomIn } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PhotoCropDialog({
  imageUrl,
  remaining,
  onCancel,
  onDone,
  onConfirm,
  onUseOriginal,
  aspect = 9 / 16,
  title = "Enquadrar foto",
  formatLabel = "vertical do cardápio (9:16)",
}: {
  imageUrl: string;
  remaining: number;
  onCancel: () => void;
  onDone: () => void;
  onConfirm: (pixels: Area) => Promise<boolean>;
  onUseOriginal?: () => Promise<boolean>;
  aspect?: number;
  title?: string;
  formatLabel?: string;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    try {
      if (await action()) onDone();
    } catch (error) {
      const message = (error as Error).message;
      if (message) toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6"
        aria-describedby="crop-description"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="crop-description">
            Arraste a imagem e ajuste o zoom para o formato {formatLabel}.
            {remaining > 1 && ` ${remaining} fotos nesta seleção.`}
          </DialogDescription>
        </DialogHeader>
        <div
          className="relative mx-auto max-h-[58dvh] max-w-full overflow-hidden rounded-xl bg-secondary"
          style={{ aspectRatio: aspect, width: "min(100%, 320px)" }}
        >
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={3}
            aspect={aspect}
            cropShape="rect"
            showGrid
            objectFit="horizontal-cover"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPixels) => setPixels(areaPixels)}
          />
        </div>
        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <label htmlFor="photo-zoom" className="sr-only">
            Zoom da foto
          </label>
          <input
            id="photo-zoom"
            aria-label="Zoom da foto"
            className="w-full accent-primary"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <output htmlFor="photo-zoom" className="w-12 text-right text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </output>
        </div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          {onUseOriginal && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run(onUseOriginal)}
            >
              Usar original
            </Button>
          )}
          <Button
            type="button"
            disabled={busy || !pixels}
            onClick={() => void run(() => onConfirm(pixels!))}
          >
            {busy ? "Enviando…" : "Cortar e enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
