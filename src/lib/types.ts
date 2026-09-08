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
  cpf?: string;
  phone?: string;
  whatsapp: string;
  instagram?: string;
  email?: string;
  cep?: string;
  address: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  partyDate?: string;
  theme?: string;
  age?: string;
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

export type ItemCondition = "Novo" | "Ótimo" | "Bom" | "Regular";
export type ItemStatus = "Ativo" | "Arquivado" | "Manutenção";

export interface InventoryItem {
  id: string; // e.g. "AC-001" or uid
  code?: string; // código visível
  name: string;
  category?: string;
  description?: string;
  quantity: number; // total
  inMaintenance?: number;
  damaged?: number;
  lost?: number;
  rentalPrice?: number;
  replacementPrice?: number;
  condition?: ItemCondition;
  notes?: string;
  photo?: string;
  photos?: string[];
  showInCatalog?: boolean;
  status?: ItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface KitItemComponent {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface Kit {
  id: string;
  name: string;
  category: string;
  description?: string;
  rentalPrice: number;
  photo?: string;
  photos?: string[];
  items: KitItemComponent[];
  showInCatalog?: boolean;
  createdAt: string;
}

export type EventType =
  | "Aniversário"
  | "Chá revelação"
  | "Chá de bebê"
  | "Batizado"
  | "Casamento"
  | "Formatura"
  | "Evento empresarial"
  | "Outro";

export type EventStatus =
  | "Orçamento"
  | "Confirmado"
  | "Retirado"
  | "Devolvido"
  | "Finalizado"
  | "Cancelado";

export interface EventRentedItem {
  type: "item" | "kit";
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PickupCheckRecord {
  checked: boolean;
  date?: string;
  responsible?: string;
  notes?: string;
  itemsDelivered?: { itemId: string; name: string; quantity: number }[];
}

export interface ReturnCheckItem {
  itemId: string;
  name: string;
  deliveredQty: number;
  returnedQty: number;
  damagedQty: number;
  maintenanceQty: number;
  lostQty: number;
  status: "OK" | "Danificado" | "Faltando" | "Manutenção";
  notes?: string;
}

export interface ReturnCheckRecord {
  checked: boolean;
  date?: string;
  responsible?: string;
  notes?: string;
  itemsReturned?: ReturnCheckItem[];
}

export interface EventModel {
  id: string;
  clientId: string;
  clientName: string;
  type: EventType;
  birthdayPerson?: string;
  age?: string;
  theme: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string;
  returnDate: string; // YYYY-MM-DD
  returnTime: string;
  status: EventStatus;
  items: EventRentedItem[];
  quoteId?: string;
  contractId?: string;
  notes?: string;
  pickupCheck?: PickupCheckRecord;
  returnCheck?: ReturnCheckRecord;
  createdAt: string;
}

export type QuoteStatus =
  | "Rascunho"
  | "Enviado"
  | "Aguardando cliente"
  | "Aprovado"
  | "Reprovado"
  | "Expirado"
  | "Convertido em contrato";

export interface Quote {
  id: string;
  clientId?: string;
  clientName: string;
  eventId?: string;
  theme: string;
  description: string;
  items?: EventRentedItem[];
  value: number; // subtotal decoração / itens
  delivery: number; // frete
  assembly?: number; // montagem
  extraServices?: number;
  discount?: number;
  date: string;
  time: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  deposit: number;
  paymentMethod?: string;
  validUntil?: string;
  holdUntil?: string; // data limite de pré-reserva
  status?: QuoteStatus;
  notes?: string;
  createdAt: string;
}

export type ContractStatus = "Pendente" | "Assinado" | "Cancelado";

export interface Contract {
  id: string;
  clientId?: string;
  clientName: string;
  whatsapp?: string;
  clientPhone?: string;
  cpf: string;
  eventId?: string;
  quoteId?: string;
  partyDate: string;
  theme: string;
  items?: EventRentedItem[];
  value: number;
  deposit: number;
  delivery?: number;
  assembly?: number;
  discount?: number;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  signed: boolean;
  signature: string;
  signatureImage?: string;
  signedAt?: string;
  signerIp?: string;
  status?: ContractStatus;
  createdAt: string;
  customTerms?: string;
  pdfGeneratedAt?: string;
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
  clientId?: string;
  client?: string;
  eventId?: string;
  contractId?: string;
  amount: number;
  date: string;
  method?: string;
  status: "Pago" | "Pendente" | "Atrasado";
  receiptGeneratedAt?: string;
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

export interface CompanySettings {
  name: string;
  tradeName: string;
  cnpjCpf: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  pixKey: string;
  pixType: "CPF" | "CNPJ" | "E-mail" | "Telefone" | "Chave Aleatória";
  bankName: string;
  ownerName: string;
  logo: string;
  terms: string;
}

export interface PublicFormSubmission {
  id: string;
  contractId?: string;
  clientId?: string;
  clientName: string;
  cpf: string;
  whatsapp: string;
  email?: string;
  cep?: string;
  address: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  eventType: EventType;
  birthdayPerson?: string;
  age?: string;
  eventDate: string;
  eventTime?: string;
  theme: string;
  notes?: string;
  status: "Novo" | "Processado" | "Arquivado";
  createdAt: string;
}

export interface ActionLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user?: string;
}

export interface TenantData {
  clients: Client[];
  themes: PartyTheme[];
  inventoryItems: InventoryItem[];
  kits: Kit[];
  eventsList: EventModel[];
  events: CalendarEvent[];
  quotes: Quote[];
  contracts: Contract[];
  transactions: Transaction[];
  templates: MessageTemplate[];
  categories: string[];
  companySettings: CompanySettings;
  formSubmissions: PublicFormSubmission[];
  actionLogs: ActionLog[];
  contractRules: string;
  catalogEnabled?: boolean;
}
