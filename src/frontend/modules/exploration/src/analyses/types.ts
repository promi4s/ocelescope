import type {
  DashboardCardDefinition,
  VisualizationSpec,
} from "../model/dashboard";
import type { CardView } from "./cards";
import type { AnalysisForm } from "./fields";

export interface AnalysisEditorProps {
  ocelId: string;
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
  /** Declares the editor. One generic component renders it. */
  form: AnalysisForm;
  /** Declares the card. One generic component renders it. */
  card: CardView;
}
