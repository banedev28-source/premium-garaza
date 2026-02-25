import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { audit, getClientIp } from "@/lib/audit";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic byte signatures for allowed image formats
const MAGIC_BYTES: { signature: number[]; offset?: number; ext: string; extra?: { offset: number; bytes: number[] } }[] = [
  { signature: [0xff, 0xd8, 0xff], ext: "jpg" },
  { signature: [0x89, 0x50, 0x4e, 0x47], ext: "png" },
  { signature: [0x47, 0x49, 0x46, 0x38], ext: "gif" },
  // WebP: starts with RIFF....WEBP
  { signature: [0x52, 0x49, 0x46, 0x46], ext: "webp", extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

function detectImageType(buffer: Buffer): string | null {
  for (const magic of MAGIC_BYTES) {
    const offset = magic.offset ?? 0;
    if (buffer.length < offset + magic.signature.length) continue;

    const matches = magic.signature.every((byte, i) => buffer[offset + i] === byte);
    if (!matches) continue;

    // Check extra bytes if needed (e.g., WEBP after RIFF)
    if (magic.extra) {
      if (buffer.length < magic.extra.offset + magic.extra.bytes.length) continue;
      const extraMatches = magic.extra.bytes.every(
        (byte, i) => buffer[magic.extra!.offset + i] === byte
      );
      if (!extraMatches) continue;
    }

    return magic.ext;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 uploads per hour per user
  const rlResponse = await checkRateLimit(uploadLimiter, session.user.id);
  if (rlResponse) return rlResponse;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const urls: string[] = [];

  for (const file of files) {
    // Validate MIME type - only raster images (no SVG/XSS risk)
    if (!ALLOWED_TYPES.has(file.type)) {
      continue;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes - detect real file type
    const detectedExt = detectImageType(buffer);
    if (!detectedExt) {
      continue; // Not a valid image based on magic bytes
    }

    // Use detected extension instead of client-provided one
    const filename = `${randomBytes(16).toString("hex")}.${detectedExt}`;

    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      contentType: file.type,
    });

    urls.push(blob.url);
  }

  if (urls.length > 0) {
    const ip = await getClientIp();
    audit({ action: "FILE_UPLOADED", userId: session.user.id, metadata: { count: urls.length, files: urls }, ip });
  }

  return NextResponse.json({ urls });
}
