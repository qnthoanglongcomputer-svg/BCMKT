-- CreateTable
CREATE TABLE "ads_channel_plans" (
    "id" TEXT NOT NULL,
    "platform" "AdsPlatform" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "spend_target" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "revenue_target" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "leads_target" INTEGER NOT NULL DEFAULT 0,
    "orders_target" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ads_channel_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ads_channel_plans_year_month_idx" ON "ads_channel_plans"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ads_channel_plans_platform_year_month_key" ON "ads_channel_plans"("platform", "year", "month");
