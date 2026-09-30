import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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
import { sanitizeForFirestore, sanitizeContract } from "./firestoreUtils";

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
  currentTenant: Tenant | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateTenantSecretKey: (newSecret: string) => Promise<{ success: boolean; error?: string }>;

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
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem("crm_is_admin") === "true");
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const tid = localStorage.getItem("crm_tenant_id");
    const admin = localStorage.getItem("crm_is_admin") === "true";
    return Boolean(tid || admin);
  });
  const [data, setData] = useState<TenantData>(DEFAULT_DATA);

  // Fetch or listen to tenant data and account info
  useEffect(() => {
    if (!tenantId || isAdmin) {
      setIsLoading(false);
      setData(DEFAULT_DATA);
      setCurrentTenant(null);
      return;
    }

    setIsLoading(true);

    // 1. Listen to tenant account info (status, plan expiration, secret key)
    const unsubTenant = onSnapshot(doc(db, "tenants", tenantId), (tSnap) => {
      if (tSnap.exists()) {
        const t = tSnap.data() as Tenant;
        setCurrentTenant(t);
        // Automatic lock if blocked or plan expired while active
        if (t.status === "blocked") {
          alert("Seu acesso foi bloqueado pela administração.");
          logout();
        } else if (t.expiresAt && new Date() > new Date(t.expiresAt)) {
          const expDate = new Date(t.expiresAt).toLocaleDateString("pt-BR");
          alert(`O seu plano venceu em ${expDate}. Entre em contato para renovar.`);
          logout();
        }
      }
    });

    // 2. Listen to tenant CRM data
    const unsubData = onSnapshot(doc(db, "tenant_data", tenantId), (snapshot) => {
      if (snapshot.exists()) {
        const firestoreData = snapshot.data() as Partial<TenantData>;
        const loadedContracts = (firestoreData.contracts || []).map(sanitizeContract);
        setData({
          ...DEFAULT_DATA, // ensure all fields exist
          ...firestoreData,
          contracts: loadedContracts,
          categories: firestoreData.categories && firestoreData.categories.length > 0 ? firestoreData.categories : DEFAULT_CATEGORIES,
          companySettings: firestoreData.companySettings ? { ...DEFAULT_COMPANY_SETTINGS, ...firestoreData.companySettings } : DEFAULT_COMPANY_SETTINGS,
          kits: firestoreData.kits || [],
          eventsList: firestoreData.eventsList || [],
          formSubmissions: firestoreData.formSubmissions || [],
          actionLogs: firestoreData.actionLogs || [],
        });
      } else {
        // If data doc doesn't exist, initialize it
        setDoc(doc(db, "tenant_data", tenantId), sanitizeForFirestore(DEFAULT_DATA), { merge: true });
        setData(DEFAULT_DATA);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching tenant data", error);
      setIsLoading(false);
    });

    return () => {
      unsubTenant();
      unsubData();
    };
  }, [tenantId, isAdmin]);

  const login = async (code: string) => {
    const rawTrimmed = code.trim();
    const upper = rawTrimmed.toUpperCase();
    
    // Master Admin password
    if (upper === "ADMIN-MASTER-2026") {
      setIsAdmin(true);
      setTenantId(null);
      localStorage.setItem("crm_is_admin", "true");
      localStorage.removeItem("crm_tenant_id");
      return { success: true };
    }

    // Check Tenant code / secret key
    try {
      let tenantDoc = await getDoc(doc(db, "tenants", upper));
      let targetTenantId = upper;

      // If not found by document ID, search if code matches client's custom secret key!
      if (!tenantDoc.exists()) {
        const q = query(collection(db, "tenants"), where("secretKey", "==", rawTrimmed));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          tenantDoc = qSnap.docs[0];
          targetTenantId = tenantDoc.id;
        } else {
          // Fallback check uppercase secret key
          const qUpper = query(collection(db, "tenants"), where("secretKey", "==", upper));
          const qSnapUpper = await getDocs(qUpper);
          if (!qSnapUpper.empty) {
            tenantDoc = qSnapUpper.docs[0];
            targetTenantId = tenantDoc.id;
          }
        }
      }

      if (!tenantDoc.exists()) {
        return { success: false, error: "Código ou chave de acesso não encontrado." };
      }

      const tenant = tenantDoc.data() as Tenant;

      // Privacy: If client defined a private secret key, prevent using the old temporary code
      if (
        tenant.hasCustomKey &&
        tenant.secretKey &&
        rawTrimmed !== tenant.secretKey &&
        upper !== tenant.secretKey.toUpperCase() &&
        upper === tenant.id.toUpperCase()
      ) {
        return {
          success: false,
          error: "Você já redefiniu uma chave secreta pessoal para esta conta. Utilize sua chave pessoal para entrar.",
        };
      }

      if (tenant.status !== "active") return { success: false, error: "Acesso bloqueado pela administração." };
      
      // Automatic expiration check for all plans (Mensal, Anual, Teste 24h, etc.)
      if (tenant.expiresAt && new Date() > new Date(tenant.expiresAt)) {
        const expDate = new Date(tenant.expiresAt).toLocaleDateString("pt-BR");
        const planName =
          tenant.planType === "annual"
            ? "anual"
            : tenant.planType === "monthly"
            ? "mensal"
            : tenant.isTest
            ? "de teste (24h)"
            : "";
        return {
          success: false,
          error: `O plano ${planName} desta conta expirou em ${expDate}. Entre em contato para renovar seu acesso.`,
        };
      }

      setIsAdmin(false);
      setTenantId(targetTenantId);
      localStorage.setItem("crm_is_admin", "false");
      localStorage.setItem("crm_tenant_id", targetTenantId);
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Erro ao verificar acesso. Tente novamente." };
    }
  };

  const updateTenantSecretKey = async (newSecret: string) => {
    if (!tenantId || isAdmin) return { success: false, error: "Acesso inválido." };
    const cleanSecret = newSecret.trim();
    if (cleanSecret.length < 4) {
      return { success: false, error: "A nova chave deve ter no mínimo 4 caracteres." };
    }

    try {
      await setDoc(
        doc(db, "tenants", tenantId),
        {
          secretKey: cleanSecret,
          hasCustomKey: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      logAction("Chave Privada Definida", "Cliente redefiniu sua chave secreta de acesso");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Erro ao atualizar chave de acesso." };
    }
  };

  const logout = () => {
    setIsAdmin(false);
    setTenantId(null);
    setData(DEFAULT_DATA);
    localStorage.removeItem("crm_is_admin");
    localStorage.removeItem("crm_tenant_id");
  };

  const updateData = async (key: keyof TenantData, value: any) => {
    if (!tenantId || isAdmin) return;
    
    const sanitizedVal = key === "contracts" && Array.isArray(value)
      ? value.map(sanitizeContract)
      : sanitizeForFirestore(value);

    // Optimistic local update
    setData((prev) => ({ ...prev, [key]: sanitizedVal }));
    
    // Save to Firestore
    try {
      await setDoc(doc(db, "tenant_data", tenantId), { [key]: sanitizedVal }, { merge: true });

      // Dual-save contracts to public_contracts collection for 100% reliable public signing
      if (key === "contracts" && Array.isArray(sanitizedVal)) {
        for (const contract of sanitizedVal as Contract[]) {
          if (contract && contract.id) {
            try {
              const pubDocRef = doc(db, "public_contracts", `${tenantId}_${contract.id}`);
              await setDoc(
                pubDocRef,
                sanitizeForFirestore({
                  ...contract,
                  tenantId,
                  companySettings: {
                    name: data.companySettings?.name || "RAYDECOR Pegue e Monte",
                    tradeName: data.companySettings?.tradeName || "RAYDECOR",
                    logo: data.companySettings?.logo || "",
                    phone: data.companySettings?.phone || data.companySettings?.whatsapp || "",
                    terms: contract.customTerms || data.companySettings?.terms || data.contractRules || "",
                  },
                  updatedAt: new Date().toISOString(),
                }),
                { merge: true }
              );
            } catch (errPub) {
              console.warn("Aviso ao salvar cópia pública individual do contrato:", errPub);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Erro crítico ao salvar ${key} no Firestore:`, err);
    }
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
        currentTenant,
        isAdmin,
        isLoading,
        login,
        logout,
        updateTenantSecretKey,
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
