import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";

/** What the reader has typed, slowed to one request per pause in typing. */
export const useSearch = () => {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  return { search, setSearch, debounced: debounced || undefined };
};
