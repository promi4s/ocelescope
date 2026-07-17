import type { ComponentType } from "react";
import type { AnalyticalSchemaResponse } from "../api/querying";
import type {
  DashboardCardDefinition,
  VisualizationSpec,
} from "../model/dashboard";

export interface AnalysisEditorProps {
  ocelId: string;
  schema: AnalyticalSchemaResponse;
  initial?: VisualizationSpec;
  onCancel: () => void;
  onSubmit: (spec: VisualizationSpec) => void;
}

export interface AnalysisCardProps {
  ocelId: string;
  card: DashboardCardDefinition;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export interface AnalysisDefinition {
  id: VisualizationSpec["analysis"];
  category: "Attributes" | "Relationships" | "Behavior" | "Time";
  label: string;
  description: string;
  Editor: ComponentType<AnalysisEditorProps>;
  Card: ComponentType<AnalysisCardProps>;
}
