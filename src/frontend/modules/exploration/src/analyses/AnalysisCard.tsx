import { ChartCard } from "@ocelescope/charts";

import { AnalysisCardActions } from "./AnalysisCardActions";
import { findAnalysisDefinition } from "./registry";
import type { AnalysisCardProps } from "./types";
import { useAnalysisQuery } from "./useAnalysisQuery";

/**
 * The only card in the module. It fetches, frames and renders every analysis;
 * what differs per analysis is the view declared in the registry.
 */
export function AnalysisCard({
  ocelId,
  card,
  onEdit,
  onDuplicate,
  onRemove,
}: AnalysisCardProps) {
  const definition = findAnalysisDefinition(card.spec.analysis);
  const spec = card.spec;
  const query = "query" in spec ? spec.query : undefined;
  const { data, isPending, error } = useAnalysisQuery<unknown>(
    ocelId,
    spec.analysis,
    query,
  );

  if (!definition) return null;
  const view = definition.card;

  const empty = data == null ? false : (view.isEmpty?.(data) ?? false);

  return (
    <ChartCard
      title={view.title(spec)}
      {...(view.subtitle ? { subtitle: view.subtitle(spec) } : {})}
      info={view.info(spec)}
      filename={view.filename}
      error={error ? String(error) : undefined}
      height={300}
      expandedHeight={680}
      {...(data != null && view.note ? { note: view.note(data, spec) } : {})}
      actions={
        <AnalysisCardActions
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      }
    >
      {view.chart(data, spec, {
        loading: isPending,
        empty,
        emptyMessage: view.emptyMessage,
      })}
    </ChartCard>
  );
}
