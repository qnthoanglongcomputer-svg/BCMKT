-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MARKETING_MANAGER', 'LEADER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('COMPANY', 'DEPARTMENT', 'TEAM', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY');

-- CreateEnum
CREATE TYPE "MetricDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "MetricAggregation" AS ENUM ('SUM', 'RATIO');

-- CreateEnum
CREATE TYPE "AllocationStrategy" AS ENUM ('EVEN', 'WEIGHTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdsPlatform" AS ENUM ('FACEBOOK', 'GOOGLE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED', 'NEEDS_REAUTH');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'SUBMIT', 'REOPEN', 'EXPORT', 'LOGIN');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "department_id" TEXT,
    "position_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" "MetricDirection" NOT NULL DEFAULT 'HIGHER_BETTER',
    "aggregation" "MetricAggregation" NOT NULL DEFAULT 'SUM',
    "numerator_code" TEXT,
    "denominator_code" TEXT,
    "achievement_cap" DECIMAL(9,4) NOT NULL DEFAULT 1.2000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_plans" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "year_target" DECIMAL(18,2) NOT NULL,
    "strategy" "AllocationStrategy" NOT NULL DEFAULT 'EVEN',
    "month_weights" JSONB,
    "locked_months" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "kpi_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_targets" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "target_value" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_actuals" (
    "id" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "actual_value" DECIMAL(18,2) NOT NULL,
    "numerator_sum" DECIMAL(18,2),
    "denominator_sum" DECIMAL(18,2),
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_weight_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position_id" TEXT,
    "department_id" TEXT,
    "effective_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "kpi_weight_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_weights" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "weight" DECIMAL(9,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "budget" DECIMAL(18,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "report_date" DATE NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_details" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "hours_spent" DECIMAL(9,4),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_summary" (
    "id" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "score" DECIMAL(9,4) NOT NULL,
    "grade" TEXT NOT NULL,
    "forecast" DECIMAL(18,2),
    "confidence" DECIMAL(9,4),
    "computed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_summary" (
    "id" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "output_count" DECIMAL(18,2) NOT NULL,
    "hours_spent" DECIMAL(18,2) NOT NULL,
    "productivity" DECIMAL(18,4),
    "computed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads_insights" (
    "id" TEXT NOT NULL,
    "platform" "AdsPlatform" NOT NULL,
    "account_id" TEXT NOT NULL,
    "campaign_ext_id" TEXT NOT NULL,
    "adset_ext_id" TEXT,
    "ad_ext_id" TEXT,
    "date" DATE NOT NULL,
    "campaign_name" TEXT,
    "adset_name" TEXT,
    "ad_name" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "video_views" INTEGER NOT NULL DEFAULT 0,
    "frequency" DECIMAL(9,4),
    "campaign_id" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads_sync_logs" (
    "id" TEXT NOT NULL,
    "platform" "AdsPlatform" NOT NULL,
    "account_id" TEXT NOT NULL,
    "range_start" DATE NOT NULL,
    "range_end" DATE NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "ads_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "data_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kpi_definition_id" TEXT,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "condition" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "read_at" TIMESTAMP(3),
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "departments_deleted_at_idx" ON "departments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_code_key" ON "kpi_definitions"("code");

-- CreateIndex
CREATE INDEX "kpi_definitions_is_active_idx" ON "kpi_definitions"("is_active");

-- CreateIndex
CREATE INDEX "kpi_plans_year_idx" ON "kpi_plans"("year");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_plans_year_owner_type_owner_id_kpi_definition_id_key" ON "kpi_plans"("year", "owner_type", "owner_id", "kpi_definition_id");

-- CreateIndex
CREATE INDEX "kpi_targets_owner_type_owner_id_period_type_period_start_idx" ON "kpi_targets"("owner_type", "owner_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "kpi_targets_plan_id_idx" ON "kpi_targets"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_targets_owner_type_owner_id_kpi_definition_id_period_ty_key" ON "kpi_targets"("owner_type", "owner_id", "kpi_definition_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "kpi_actuals_owner_type_owner_id_period_type_period_start_idx" ON "kpi_actuals"("owner_type", "owner_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "kpi_actuals_campaign_id_idx" ON "kpi_actuals"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_actuals_owner_type_owner_id_kpi_definition_id_period_ty_key" ON "kpi_actuals"("owner_type", "owner_id", "kpi_definition_id", "period_type", "period_start", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_weight_groups_position_id_department_id_effective_year_key" ON "kpi_weight_groups"("position_id", "department_id", "effective_year");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_weights_group_id_kpi_definition_id_key" ON "kpi_weights"("group_id", "kpi_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_code_key" ON "campaigns"("code");

-- CreateIndex
CREATE INDEX "campaigns_start_date_end_date_idx" ON "campaigns"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "campaigns_is_active_idx" ON "campaigns"("is_active");

-- CreateIndex
CREATE INDEX "reports_department_id_report_date_status_idx" ON "reports"("department_id", "report_date", "status");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reports_author_id_report_date_campaign_id_key" ON "reports"("author_id", "report_date", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_details_report_id_kpi_definition_id_key" ON "report_details"("report_id", "kpi_definition_id");

-- CreateIndex
CREATE INDEX "attachments_report_id_idx" ON "attachments"("report_id");

-- CreateIndex
CREATE INDEX "kpi_summary_period_type_period_start_score_idx" ON "kpi_summary"("period_type", "period_start", "score");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_summary_owner_type_owner_id_period_type_period_start_key" ON "kpi_summary"("owner_type", "owner_id", "period_type", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "performance_summary_owner_type_owner_id_period_type_period__key" ON "performance_summary"("owner_type", "owner_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "ads_insights_platform_date_idx" ON "ads_insights"("platform", "date");

-- CreateIndex
CREATE INDEX "ads_insights_campaign_id_date_idx" ON "ads_insights"("campaign_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ads_insights_platform_account_id_campaign_ext_id_adset_ext__key" ON "ads_insights"("platform", "account_id", "campaign_ext_id", "adset_ext_id", "ad_ext_id", "date");

-- CreateIndex
CREATE INDEX "ads_sync_logs_platform_started_at_idx" ON "ads_sync_logs"("platform", "started_at");

-- CreateIndex
CREATE INDEX "ai_insights_owner_type_owner_id_period_start_idx" ON "ai_insights"("owner_type", "owner_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "ai_insights_owner_type_owner_id_period_type_period_start_da_key" ON "ai_insights"("owner_type", "owner_id", "period_type", "period_start", "data_hash");

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_code_key" ON "alert_rules"("code");

-- CreateIndex
CREATE INDEX "alerts_owner_type_owner_id_triggered_at_idx" ON "alerts"("owner_type", "owner_id", "triggered_at");

-- CreateIndex
CREATE INDEX "alerts_resolved_at_idx" ON "alerts"("resolved_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "kpi_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_actuals" ADD CONSTRAINT "kpi_actuals_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_actuals" ADD CONSTRAINT "kpi_actuals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weight_groups" ADD CONSTRAINT "kpi_weight_groups_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weight_groups" ADD CONSTRAINT "kpi_weight_groups_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weights" ADD CONSTRAINT "kpi_weights_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "kpi_weight_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weights" ADD CONSTRAINT "kpi_weights_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_details" ADD CONSTRAINT "report_details_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_details" ADD CONSTRAINT "report_details_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads_insights" ADD CONSTRAINT "ads_insights_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
