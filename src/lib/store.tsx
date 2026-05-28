import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  Client,
  PartyTheme,
  Quote,
  Contract,
  CalendarEvent,
  Transaction,
  MessageTemplate,
} from "./types";
import {
  seedClients,
  seedThemes,
  seedQuotes,
  seedContracts,
  seedEvents,
  seedTransactions,
  seedTemplates,
} from "./seed";

interface State {
  clients: Client[];
  themes: PartyTheme[];
  quotes: Quote[];
  contracts: Contract[];
  events: CalendarEvent[];
  transactions: Transaction[];
  templates: MessageTemplate[];
  setClients: (v: Client[]) => void;
  setThemes: (v: PartyTheme[]) => void;
  setQuotes: (v: Quote[]) => void;
  setContracts: (v: Contract[]) => void;
  setEvents: (v: CalendarEvent[]) => void;
  setTransactions: (v: Transaction[]) => void;
}

const Ctx = createContext<State | null>(null);

function usePersisted<T>(key: string, seed: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : seed;
    } catch {
      return seed;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }, [key, val]);
  return [val, setVal];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = usePersisted("fc_clients", seedClients);
  const [themes, setThemes] = usePersisted("fc_themes", seedThemes);
  const [quotes, setQuotes] = usePersisted("fc_quotes", seedQuotes);
  const [contracts, setContracts] = usePersisted("fc_contracts", seedContracts);
  const [events, setEvents] = usePersisted("fc_events", seedEvents);
  const [transactions, setTransactions] = usePersisted("fc_tx", seedTransactions);
  const [templates] = usePersisted("fc_templates", seedTemplates);

  return (
    <Ctx.Provider
      value={{
        clients,
        themes,
        quotes,
        contracts,
        events,
        transactions,
        templates,
        setClients,
        setThemes,
        setQuotes,
        setContracts,
        setEvents,
        setTransactions,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
