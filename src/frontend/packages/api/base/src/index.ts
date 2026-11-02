// Both specs generate the (identical) FastAPI validation-error and paginated string
// types; re-export them from one place so the star re-exports above are not ambiguous.
export type {
  HTTPValidationError,
  PaginatedResponseListStr,
  ValidationError,
  ValidationErrorCtx,
} from "./api/base";
export * from "./api/base";
export * from "./api/ocel";
