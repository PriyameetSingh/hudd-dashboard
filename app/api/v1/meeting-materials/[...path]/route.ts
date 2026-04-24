import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getFilePath } from "@/lib/local-file-storage";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const { path: pathParts } = await ctx.params;
    if (!pathParts || pathParts.length === 0) {
      return NextResponse.json({ detail: "Invalid file path" }, { status: 400 });
    }

    const storagePath = pathParts.join("/");
    const filePath = getFilePath(storagePath);

    try {
      const buffer = await fs.readFile(filePath);
      // Extract MIME type from the storage path or use default
      const mimeType = getMimeTypeFromPath(storagePath);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "private, max-age=3600", // 1 hour
        },
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({ detail: "File not found" }, { status: 404 });
      }
      throw err;
    }
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

/**
 * Determine MIME type from file extension.
 */
function getMimeTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    txt: "text/plain",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
