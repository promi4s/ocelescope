import { useEffect, useState } from "react";

const DELAY_MS = 300;

/** What the reader has typed, slowed to one request per pause in typing. */
export const useSearch = () => {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);
  return { search, setSearch, debounced: debounced || undefined };
};
