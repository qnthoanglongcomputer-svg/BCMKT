-- AddForeignKey
ALTER TABLE "kpi_plans" ADD CONSTRAINT "kpi_plans_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
