import { Alert, Button, Loader, Stack, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../shared/api-client.js";
import { monthlyOverviewSchema, type MonthlyOverview } from "../shared/api-contracts.js";
import { MonthSelector } from "../shared/MonthSelector.js";
import { BudgetCategoryTable } from "./BudgetCategoryTable.js";
import { MonthAtGlance } from "./MonthAtGlance.js";
import { MonthlyHealthSummary } from "./MonthlyHealthSummary.js";
import { PaymentSourceSummary } from "./PaymentSourceSummary.js";
import { MonthlyAttentionPanel } from "./MonthlyAttentionPanel.js";
import { MonthlyTransfersPanel } from "./MonthlyTransfersPanel.js";
import { MonthlyBudgetEmptyState } from "./MonthlyBudgetEmptyState.js";
import { MonthlyIncomePlanningPanel } from "./MonthlyIncomePlanningPanel.js";
export function MonthlyOverviewPage({
  selectedMonth,
  setSelectedMonth
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}) {
  const [data, setData] = useState<MonthlyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        await apiClient.get(`/monthly-overview?month=${selectedMonth}`, monthlyOverviewSchema)
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o mês.");
    }
  }, [selectedMonth]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Stack>
      <Title order={2}>Visão do mês</Title>
      <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
      {error ? (
        <Alert color="red" title="Não foi possível carregar">
          <Stack gap="sm">
            <span>{error}</span>
            <Button variant="light" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </Stack>
        </Alert>
      ) : data ? (
        <>
          <MonthAtGlance summary={data.summary} />
          <MonthlyIncomePlanningPanel
            data={data.incomePlanning}
            month={selectedMonth}
            onChanged={load}
          />
          {data.summary.plannedCents === 0 && (
            <MonthlyBudgetEmptyState month={selectedMonth} onChanged={load} />
          )}
          <MonthlyAttentionPanel items={data.items} />
          <MonthlyHealthSummary data={data} />
          <PaymentSourceSummary sources={data.sourceSummary} />
          <BudgetCategoryTable
            items={data.items}
            paymentMethodOptions={data.availablePaymentMethods}
            month={selectedMonth}
            onChanged={load}
          />
          <MonthlyTransfersPanel transfers={data.transfers} />
        </>
      ) : (
        <Loader />
      )}
    </Stack>
  );
}
