import type {
  DownloadOcelOcelsDownloadGetExt,
  EventAttributes200Item,
  GetFiltersParams,
  ObjectAttributes200Item,
} from "@/api/fastapi-schemas";

export type OcelInputType = GetFiltersParams;

export type OcelAttribute = ObjectAttributes200Item | EventAttributes200Item;

export type OCELExtensions = DownloadOcelOcelsDownloadGetExt;
