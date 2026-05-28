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
  contractRules: string;
  setClients: (v: Client[]) => void;
  setThemes: (v: PartyTheme[]) => void;
  setQuotes: (v: Quote[]) => void;
  setContracts: (v: Contract[]) => void;
  setEvents: (v: CalendarEvent[]) => void;
  setTransactions: (v: Transaction[]) => void;
  setContractRules: (v: string) => void;
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
  const [clients, setClients] = usePersisted("app_clients", [] as Client[]);
  const [themes, setThemes] = usePersisted("app_themes", [] as PartyTheme[]);
  const [quotes, setQuotes] = usePersisted("app_quotes", [] as Quote[]);
  const [contracts, setContracts] = usePersisted("app_contracts", [] as Contract[]);
  const [events, setEvents] = usePersisted("app_events", [] as CalendarEvent[]);
  const [transactions, setTransactions] = usePersisted("app_tx", [] as Transaction[]);
  const [templates] = usePersisted("app_templates", seedTemplates);
  const [contractRules, setContractRules] = usePersisted(
    "app_contract_rules",
    "*Regras de uso:*\n" +
      "• A decoração é locada no formato Pegue e Monte, com retirada/montagem conforme combinado.\n" +
      "• O cliente é responsável pela conservação das peças durante o período de locação.\n" +
      "• Não é permitido o uso de fitas, colas ou objetos que danifiquem as peças.\n\n" +
      "*Regras de devolução:*\n" +
      "• A devolução deve ocorrer na data e horário acordados, com as peças limpas.\n" +
      "• Peças danificadas ou perdidas serão cobradas conforme valor de reposição.\n" +
      "• O sinal não é reembolsável em caso de cancelamento com menos de 7 dias."
  );

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
        contractRules,
        setContractRules,
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
