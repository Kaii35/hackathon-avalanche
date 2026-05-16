-- CreateEnum
CREATE TYPE "AdminInviteStatus" AS ENUM ('pending', 'consumed', 'revoked');

-- CreateTable
CREATE TABLE "admin_invites" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" "AdminInviteStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "invited_by_id" UUID,
    "consumed_by_id" UUID,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_invites_email_key" ON "admin_invites"("email");

-- CreateIndex
CREATE INDEX "admin_invites_status_idx" ON "admin_invites"("status");
