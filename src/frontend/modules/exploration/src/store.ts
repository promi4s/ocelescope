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
    /** False until the stored dashboard has been read. */
    loaded,
    add: (analysis: string) => {
      const id = globalThis.crypto.randomUUID();
      setCards((current) => [...current, { id, analysis, values: {} }]);
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
