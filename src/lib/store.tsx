import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type {
  Client,
  PartyTheme,
  Quote,
  Contract,
  CalendarEvent,
  Transaction,
  MessageTemplate,
  TenantData,
  Tenant
} from "./types";
import { seedTemplates } from "./seed";

const DEFAULT_CONTRACT_RULES =
  "*Regras de uso:*\n" +
  "• A decoração é locada no formato Pegue e Monte, com retirada/montagem conforme combinado.\n" +
  "• O cliente é responsável pela conservação das peças durante o período de locação.\n" +
  "• Não é permitido o uso de fitas, colas ou objetos que danifiquem as peças.\n\n" +
  "*Regras de devolução:*\n" +
  "• A devolução deve ocorrer na data e horário acordados, com as peças limpas.\n" +
  "• Peças danificadas ou perdidas serão cobradas conforme valor de reposição.\n" +
  "• O sinal não é reembolsável em caso de cancelamento com menos de 7 dias.";

const DEFAULT_DATA: TenantData = {
  clients: [],
  themes: [],
  quotes: [],
  contracts: [],
  events: [],
  transactions: [],
  templates: seedTemplates,
  contractRules: DEFAULT_CONTRACT_RULES,
};

interface State extends TenantData {
  tenantId: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  setClients: (v: Client[]) => void;
  setThemes: (v: PartyTheme[]) => void;
  setQuotes: (v: Quote[]) => void;
  setContracts: (v: Contract[]) => void;
  setEvents: (v: CalendarEvent[]) => void;
  setTransactions: (v: Transaction[]) => void;
  setContractRules: (v: string) => void;
}

const Ctx = createContext<State | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(() => localStorage.getItem("crm_tenant_id"));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem("crm_is_admin") === "true");
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const tid = localStorage.getItem("crm_tenant_id");
    const admin = localStorage.getItem("crm_is_admin") === "true";
    return Boolean(tid || admin);
  });
  const [data, setData] = useState<TenantData>(DEFAULT_DATA);

  // Fetch or listen to tenant data
  useEffect(() => {
    if (!tenantId || isAdmin) {
      setIsLoading(false);
      setData(DEFAULT_DATA);
      return;
    }

    setIsLoading(true);
    const unsub = onSnapshot(doc(db, "tenant_data", tenantId), (snapshot) => {
      if (snapshot.exists()) {
        const firestoreData = snapshot.data() as Partial<TenantData>;
        setData({
          ...DEFAULT_DATA, // ensure all fields exist
          ...firestoreData,
        });
      } else {
        // If data doc doesn't exist, initialize it
        setDoc(doc(db, "tenant_data", tenantId), DEFAULT_DATA, { merge: true });
        setData(DEFAULT_DATA);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching tenant data", error);
      setIsLoading(false);
    });

    return () => unsub();
  }, [tenantId, isAdmin]);

  const login = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    
    // Master Admin password
    if (trimmed === "ADMIN-MASTER-2026") {
      setIsAdmin(true);
      setTenantId(null);
      localStorage.setItem("crm_is_admin", "true");
      localStorage.removeItem("crm_tenant_id");
      return { success: true };
    }

    // Check Tenant code
    try {
      const tenantDoc = await getDoc(doc(db, "tenants", trimmed));
      if (!tenantDoc.exists()) {
        return { success: false, error: "Código de acesso não encontrado." };
      }

      const tenant = tenantDoc.data() as Tenant;
      if (tenant.status === "blocked") {
        return { success: false, error: "Este acesso está bloqueado. Contate o suporte." };
      }

      setIsAdmin(false);
      setTenantId(trimmed);
      localStorage.setItem("crm_is_admin", "false");
      localStorage.setItem("crm_tenant_id", trimmed);
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Erro ao verificar acesso. Tente novamente." };
    }
  };

  const logout = () => {
    setIsAdmin(false);
    setTenantId(null);
    setData(DEFAULT_DATA);
    localStorage.removeItem("crm_is_admin");
    localStorage.removeItem("crm_tenant_id");
  };

  const updateData = (key: keyof TenantData, value: any) => {
    if (!tenantId || isAdmin) return;
    
    // Optimistic local update
    setData((prev) => ({ ...prev, [key]: value }));
    
    // Save to Firestore
    setDoc(doc(db, "tenant_data", tenantId), { [key]: value }, { merge: true }).catch(console.error);
  };

  return (
    <Ctx.Provider
      value={{
        ...data,
        tenantId,
        isAdmin,
        isLoading,
        login,
        logout,
        setClients: (v) => updateData("clients", v),
        setThemes: (v) => updateData("themes", v),
        setQuotes: (v) => updateData("quotes", v),
        setContracts: (v) => updateData("contracts", v),
        setEvents: (v) => updateData("events", v),
        setTransactions: (v) => updateData("transactions", v),
        setContractRules: (v) => updateData("contractRules", v),
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
