/** The dashboard a reader has built, kept per OCEL in browser storage. */
import { useEffect, useState } from "react";
import { findAnalysis, type Values } from "./analyses";

export interface Card {
  id: string;
  analysis: string;
  values: Values;
}

const key = (ocelId: string) => `ocelescope:exploration:${ocelId}`;

export const useCards = (ocelId: string) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setCards(read(ocelId));
    setLoaded(true);
  }, [ocelId]);

  useEffect(() => {
    // Storage can be unavailable; the dashboard still works, it just forgets.
    if (!loaded) return;
    try {
      window.localStorage.setItem(key(ocelId), JSON.stringify(cards));
    } catch {}
  }, [cards, loaded, ocelId]);

  return {
    cards,
    add: (analysis: string) => {
      const id = globalThis.crypto.randomUUID();
      setCards((current) => [
        ...current,
        {
          id,
          analysis,
          values: fixed(analysis),
        },
      ]);
      return id;
    },
    update: (id: string, values: Values) =>
      setCards((current) =>
        current.map((card) => (card.id === id ? { ...card, values } : card)),
      ),
    remove: (id: string) =>
      setCards((current) => current.filter((card) => card.id !== id)),
  };
};

/**
 * A new card starts with nothing chosen: which activity or object type a chart
 * is about is the reader's question to ask, and guessing it for them either
 * shows an arbitrary one or, across all of them at once, an unreadable chart.
 *
 * Only settings that are not names from the log - a bin count, a time unit -
 * carry their built-in value.
 */
const fixed = (analysis: string): Values =>
  Object.fromEntries(
    (findAnalysis(analysis)?.params ?? [])
      .map((param) => [param.name, param.default ?? param.options?.[0]])
      .filter(([, value]) => value != null),
  );

const read = (ocelId: string): Card[] => {
  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(key(ocelId)) ?? "[]",
    );
    return Array.isArray(stored)
      ? stored.filter((card: Card) => findAnalysis(card?.analysis))
      : [];
  } catch {
    return [];
  }
};
