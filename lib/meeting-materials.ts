/** MIME types allowed for meeting presentations (PDF, PPTX, legacy PPT). */
export const MEETING_MATERIAL_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

export const MEETING_MATERIAL_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export function sanitizeMeetingFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "file";
  return base.length > 200 ? base.slice(0, 200) : base;
}

export function assertAllowedMeetingMaterial(file: File): void {
  const mime = file.type || "";
  if (!MEETING_MATERIAL_ALLOWED_MIME.has(mime)) {
    throw new Error("Only PDF and PowerPoint files (.pdf, .ppt, .pptx) are allowed.");
  }
  if (file.size > MEETING_MATERIAL_MAX_BYTES) {
    throw new Error(`File is too large (max ${MEETING_MATERIAL_MAX_BYTES / (1024 * 1024)} MB).`);
  }
}
