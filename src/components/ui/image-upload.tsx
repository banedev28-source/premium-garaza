"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ImageUploadProps = {
  images: string[];
  onChange: (images: string[]) => void;
};

const MAX_VISIBLE = 6;

// Compress image to JPEG under target size using canvas
async function compressImage(file: File, maxSize = 3 * 1024 * 1024): Promise<File> {
  // Skip if already small enough or not an image type we can compress
  if (file.size <= maxSize) return file;

  const bitmap = await createImageBitmap(file);

  // Scale down if very large resolution
  let { width, height } = bitmap;
  const maxDim = 3840; // 4K max
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try decreasing quality until under maxSize
  let quality = 0.85;
  let blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  while (blob.size > maxSize && quality > 0.3) {
    quality -= 0.1;
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function ImageUpload({ images, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file);
      formData.append("files", compressed);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || `Greska pri ucitavanju (${res.status})`);
        return;
      }

      const data = await res.json();
      if (!data.urls?.length) {
        toast.error("Fajl nije prihvacen. Dozvoljeni formati: JPG, PNG, WebP, GIF (max 10MB)");
        return;
      }
      onChange([...images, ...data.urls]);
    } catch {
      toast.error("Greska pri ucitavanju slike");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  const visibleImages = showAll ? images : images.slice(0, MAX_VISIBLE);
  const hiddenCount = images.length - MAX_VISIBLE;

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{images.length} slika</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {visibleImages.map((src, idx) => (
              <div key={idx} className="relative group aspect-video rounded-md overflow-hidden border">
                <img src={src} alt="" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-primary hover:underline w-full text-center py-1"
            >
              {showAll ? "Prikazi manje" : `+ jos ${hiddenCount} slika`}
            </button>
          )}
        </>
      )}

      <div
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <p className="text-sm text-muted-foreground">Ucitavanje...</p>
        ) : (
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-2 text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p className="text-sm text-muted-foreground">
              Kliknite ili prevucite slike ovde
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, WebP, GIF &middot; Max 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
