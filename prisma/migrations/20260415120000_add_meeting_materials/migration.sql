-- CreateTable
CREATE TABLE "meeting_materials" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_materials_storagePath_key" ON "meeting_materials"("storagePath");

-- CreateIndex
CREATE INDEX "meeting_materials_meetingId_idx" ON "meeting_materials"("meetingId");

-- AddForeignKey
ALTER TABLE "meeting_materials" ADD CONSTRAINT "meeting_materials_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "dashboard_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_materials" ADD CONSTRAINT "meeting_materials_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
