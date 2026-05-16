-- CreateEnum
CREATE TYPE "Role" AS ENUM ('investor', 'issuer', 'admin');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('draft', 'active', 'closed');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('open', 'partial', 'filled', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('kyc_verified', 'order_filled', 'order_cancelled', 'wallet_frozen', 'forced_transfer', 'offering_active');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'investor',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "wallet" TEXT NOT NULL,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'pending',
    "jurisdiction" INTEGER NOT NULL,
    "accredited" BOOLEAN NOT NULL DEFAULT false,
    "claim_hash" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cnbv_license" TEXT NOT NULL,
    "kyc_issuer_address" TEXT NOT NULL,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "token_address" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "prospectus_ipfs" TEXT NOT NULL,
    "total_supply" DECIMAL(38,18) NOT NULL,
    "price_per_unit" DECIMAL(38,18) NOT NULL,
    "lockup_until" TIMESTAMP(3) NOT NULL,
    "max_holders" INTEGER NOT NULL,
    "allowed_jurisdictions" INTEGER[],
    "status" "OfferingStatus" NOT NULL DEFAULT 'draft',
    "sector" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_table_entries" (
    "id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "wallet" TEXT NOT NULL,
    "balance" DECIMAL(38,18) NOT NULL,
    "percent_of_total" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "last_updated_block" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cap_table_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_hash" TEXT NOT NULL,
    "maker_wallet" TEXT NOT NULL,
    "offering_id" UUID NOT NULL,
    "side" "OrderSide" NOT NULL,
    "qty" DECIMAL(38,18) NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "filled_qty" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "signature" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'open',
    "salt" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "buy_order_id" UUID NOT NULL,
    "sell_order_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "qty" DECIMAL(38,18) NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL DEFAULT 0,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "KycStatus" NOT NULL,
    "external_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT,
    "payload" JSONB NOT NULL,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "identities_wallet_key" ON "identities"("wallet");

-- CreateIndex
CREATE INDEX "identities_user_id_idx" ON "identities"("user_id");

-- CreateIndex
CREATE INDEX "identities_kyc_status_idx" ON "identities"("kyc_status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_token_address_key" ON "offerings"("token_address");

-- CreateIndex
CREATE INDEX "offerings_issuer_id_idx" ON "offerings"("issuer_id");

-- CreateIndex
CREATE INDEX "offerings_status_idx" ON "offerings"("status");

-- CreateIndex
CREATE INDEX "cap_table_entries_wallet_idx" ON "cap_table_entries"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "cap_table_entries_offering_id_wallet_key" ON "cap_table_entries"("offering_id", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_hash_key" ON "orders"("order_hash");

-- CreateIndex
CREATE INDEX "orders_offering_id_status_side_idx" ON "orders"("offering_id", "status", "side");

-- CreateIndex
CREATE INDEX "orders_maker_wallet_idx" ON "orders"("maker_wallet");

-- CreateIndex
CREATE INDEX "orders_expires_at_idx" ON "orders"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "trades_tx_hash_key" ON "trades"("tx_hash");

-- CreateIndex
CREATE INDEX "trades_offering_id_settled_at_idx" ON "trades"("offering_id", "settled_at");

-- CreateIndex
CREATE INDEX "kyc_records_user_id_idx" ON "kyc_records"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_records_provider_external_id_key" ON "kyc_records"("provider", "external_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_actor_idx" ON "audit_log"("actor");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_entries" ADD CONSTRAINT "cap_table_entries_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buy_order_id_fkey" FOREIGN KEY ("buy_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_sell_order_id_fkey" FOREIGN KEY ("sell_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
