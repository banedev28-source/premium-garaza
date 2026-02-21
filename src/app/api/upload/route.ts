import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

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

    // Sanitize and whitelist extension
    const rawExt = (file.name.split(".").pop() || "").toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : "jpg";
    const filename = `${randomBytes(16).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(uploadDir, filename), buffer);
    urls.push(`/uploads/${filename}`);
  }

  return NextResponse.json({ urls });
}
