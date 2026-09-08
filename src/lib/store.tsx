import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type {
  Client,
  PartyTheme,
  InventoryItem,
  Kit,
  EventModel,
  CalendarEvent,
  Quote,
  Contract,
  Transaction,
  MessageTemplate,
  CompanySettings,
  PublicFormSubmission,
  ActionLog,
  TenantData,
  Tenant
} from "./types";
import { seedTemplates } from "./seed";
import { uid } from "./format";

const DEFAULT_CONTRACT_RULES =
  "*Regras de uso:*\n" +
  "• A decoração é locada no formato Pegue e Monte, com retirada/montagem conforme combinado.\n" +
  "• O cliente é responsável pela conservação das peças durante o período de locação.\n" +
  "• Não é permitido o uso de fitas, colas ou objetos que danifiquem as peças.\n\n" +
  "*Regras de devolução:*\n" +
  "• A devolução deve ocorrer na data e horário acordados, com as peças limpas.\n" +
  "• Peças danificadas ou perdidas serão cobradas conforme valor de reposição especificado.\n" +
  "• O sinal de reserva não é reembolsável em caso de cancelamento com menos de 7 dias.";

export const DEFAULT_CATEGORIES: string[] = [
  "Painéis",
  "Cilindros",
  "Capas",
  "Mesas",
  "Boleiras",
  "Doceiras",
  "Bandejas",
  "Vasos",
  "Suportes",
  "Tapetes",
  "Displays",
  "Números LED",
  "Flores",
  "Balões",
  "Personagens",
  "Estruturas",
  "Kits",
  "Acessórios",
  "Outros",
];

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: "RAYDECOR Pegue e Monte",
  tradeName: "RAYDECOR",
  cnpjCpf: "",
  phone: "",
  whatsapp: "",
  email: "",
  cep: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  pixKey: "",
  pixType: "Chave Aleatória",
  bankName: "",
  ownerName: "",
  logo: "https://res.cloudinary.com/dmxeqe939/image/upload/v1785097595/ChatGPT_Image_26_de_jul._de_2026_17_25_48_ilxojd.png",
  terms: DEFAULT_CONTRACT_RULES,
};

const DEFAULT_DATA: TenantData = {
  clients: [],
  themes: [],
  inventoryItems: [],
  kits: [],
  eventsList: [],
  events: [],
  quotes: [],
  contracts: [],
  transactions: [],
  templates: seedTemplates,
  categories: DEFAULT_CATEGORIES,
  companySettings: DEFAULT_COMPANY_SETTINGS,
  formSubmissions: [],
  actionLogs: [],
  contractRules: DEFAULT_CONTRACT_RULES,
  catalogEnabled: false,
};

interface State extends TenantData {
  tenantId: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  setClients: (v: Client[]) => void;
  setThemes: (v: PartyTheme[]) => void;
  setInventoryItems: (v: InventoryItem[]) => void;
  setKits: (v: Kit[]) => void;
  setEventsList: (v: EventModel[]) => void;
  setEvents: (v: CalendarEvent[]) => void;
  setQuotes: (v: Quote[]) => void;
  setContracts: (v: Contract[]) => void;
  setTransactions: (v: Transaction[]) => void;
  setTemplates: (v: MessageTemplate[]) => void;
  setCategories: (v: string[]) => void;
  setCompanySettings: (v: CompanySettings) => void;
  setFormSubmissions: (v: PublicFormSubmission[]) => void;
  setActionLogs: (v: ActionLog[]) => void;
  setContractRules: (v: string) => void;
  setCatalogEnabled: (v: boolean) => void;
  logAction: (action: string, details: string) => void;
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
          categories: firestoreData.categories && firestoreData.categories.length > 0 ? firestoreData.categories : DEFAULT_CATEGORIES,
          companySettings: firestoreData.companySettings ? { ...DEFAULT_COMPANY_SETTINGS, ...firestoreData.companySettings } : DEFAULT_COMPANY_SETTINGS,
          kits: firestoreData.kits || [],
          eventsList: firestoreData.eventsList || [],
          formSubmissions: firestoreData.formSubmissions || [],
          actionLogs: firestoreData.actionLogs || [],
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
      if (tenant.status !== "active") return { success: false, error: "Acesso bloqueado." };
      
      if (tenant.isTest && tenant.expiresAt && new Date() > new Date(tenant.expiresAt)) {
        return { success: false, error: "O período de teste (24h) expirou." };
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

  const logAction = (action: string, details: string) => {
    const newLog: ActionLog = {
      id: uid(),
      timestamp: new Date().toISOString(),
      action,
      details,
      user: tenantId || "Sistema",
    };
    const updated = [newLog, ...(data.actionLogs || [])].slice(0, 100);
    updateData("actionLogs", updated);
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
        setInventoryItems: (v) => updateData("inventoryItems", v),
        setKits: (v) => updateData("kits", v),
        setEventsList: (v) => updateData("eventsList", v),
        setEvents: (v) => updateData("events", v),
        setQuotes: (v) => updateData("quotes", v),
        setContracts: (v) => updateData("contracts", v),
        setTransactions: (v) => updateData("transactions", v),
        setTemplates: (v) => updateData("templates", v),
        setCategories: (v) => updateData("categories", v),
        setCompanySettings: (v) => updateData("companySettings", v),
        setFormSubmissions: (v) => updateData("formSubmissions", v),
        setActionLogs: (v) => updateData("actionLogs", v),
        setContractRules: (v) => updateData("contractRules", v),
        setCatalogEnabled: (v) => updateData("catalogEnabled", v),
        logAction,
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
