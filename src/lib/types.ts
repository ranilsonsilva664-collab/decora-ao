export type ClientStatus =
  | "Novo orçamento"
  | "Aguardando resposta"
  | "Contrato enviado"
  | "Pago sinal"
  | "Agendado"
  | "Finalizado";

export interface Client {
  id: string;
  name: string;
  whatsapp: string;
  instagram: string;
  partyDate: string;
  theme: string;
  age: string;
  address: string;
  notes: string;
  photos: string[];
  status: ClientStatus;
  createdAt: string;
}

export type ThemeStatus = "Disponível" | "Reservado" | "Em manutenção";

export interface PartyTheme {
  id: string;
  name: string;
  photo: string;
  pieces: number;
  invested: number;
  rentals: number;
  revenue: number;
  status: ThemeStatus;
}

export interface Quote {
  id: string;
  clientName: string;
  theme: string;
  description: string;
  value: number;
  date: string;
  time: string;
  delivery: number;
  deposit: number;
  createdAt: string;
}

export interface Contract {
  id: string;
  clientName: string;
  cpf: string;
  partyDate: string;
  theme: string;
  value: number;
  deposit: number;
  signed: boolean;
  signature: string;
  createdAt: string;
  customTerms?: string;
}

export interface CalendarEvent {
  id: string;
  theme: string;
  clientName: string;
  date: string;
  setupTime: string;
  pickupTime: string;
  returnTime: string;
}

export type TxType = "entrada" | "saida";

export interface Transaction {
  id: string;
  type: TxType;
  description: string;
  category: string;
  client?: string;
  amount: number;
  date: string;
  method?: string;
  status: "Pago" | "Pendente";
}

export interface MessageTemplate {
  id: string;
  title: string;
  emoji: string;
  body: string;
}

export type TenantStatus = "active" | "blocked";

export interface Tenant {
  id: string; // The access code, e.g., "MARIA123"
  name: string;
  whatsapp?: string;
  isTest?: boolean;
  expiresAt?: string;
  status: TenantStatus;
  createdAt: string;
}

export interface TenantData {
  clients: Client[];
  themes: PartyTheme[];
  quotes: Quote[];
  contracts: Contract[];
  events: CalendarEvent[];
  transactions: Transaction[];
  templates: MessageTemplate[];
  contractRules: string;
}
