import type {
  Client,
  PartyTheme,
  Quote,
  Contract,
  CalendarEvent,
  Transaction,
  MessageTemplate,
} from "./types";

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export const seedClients: Client[] = [
  {
    id: "c1",
    name: "Mariana Lopes",
    whatsapp: "5511998765432",
    instagram: "mari.festas",
    partyDate: addDays(8),
    theme: "Stitch",
    age: "5 anos",
    address: "Rua das Flores, 120 - São Paulo/SP",
    notes: "Quer arco de balões azul e branco.",
    photos: [],
    status: "Pago sinal",
    createdAt: addDays(-3),
  },
  {
    id: "c2",
    name: "Beatriz Andrade",
    whatsapp: "5511991234567",
    instagram: "bia.andrade",
    partyDate: addDays(15),
    theme: "Encanto",
    age: "4 anos",
    address: "Av. Brasil, 980 - Campinas/SP",
    notes: "Festa em casa, espaço pequeno.",
    photos: [],
    status: "Contrato enviado",
    createdAt: addDays(-1),
  },
  {
    id: "c3",
    name: "Carolina Mendes",
    whatsapp: "5511987651234",
    instagram: "carol.mendes",
    partyDate: addDays(22),
    theme: "Safari Baby",
    age: "1 ano",
    address: "Rua Verde, 45 - Santos/SP",
    notes: "Tema neutro, tons terrosos.",
    photos: [],
    status: "Novo orçamento",
    createdAt: addDays(0),
  },
  {
    id: "c4",
    name: "Fernanda Rocha",
    whatsapp: "5511993338888",
    instagram: "fe.rocha",
    partyDate: addDays(-5),
    theme: "Princesas",
    age: "6 anos",
    address: "Rua Lilás, 300 - São Paulo/SP",
    notes: "Cliente recorrente.",
    photos: [],
    status: "Finalizado",
    createdAt: addDays(-20),
  },
];

export const seedThemes: PartyTheme[] = [
  { id: "t1", name: "Stitch", photo: "🩵", pieces: 24, invested: 1200, rentals: 17, revenue: 5800, status: "Reservado" },
  { id: "t2", name: "Encanto", photo: "🌸", pieces: 30, invested: 1800, rentals: 12, revenue: 4900, status: "Disponível" },
  { id: "t3", name: "Safari Baby", photo: "🦁", pieces: 28, invested: 1500, rentals: 21, revenue: 7200, status: "Disponível" },
  { id: "t4", name: "Princesas", photo: "👑", pieces: 35, invested: 2200, rentals: 26, revenue: 9800, status: "Em manutenção" },
  { id: "t5", name: "Astronauta", photo: "🚀", pieces: 20, invested: 1100, rentals: 9, revenue: 3600, status: "Disponível" },
  { id: "t6", name: "Jardim Encantado", photo: "🌷", pieces: 32, invested: 1900, rentals: 14, revenue: 5600, status: "Reservado" },
];

export const seedQuotes: Quote[] = [
  {
    id: "q1",
    clientName: "Carolina Mendes",
    theme: "Safari Baby",
    description: "Painel redondo + mesa decorada + 2 cilindros + arco de balões.",
    value: 850,
    date: addDays(22),
    time: "14:00",
    delivery: 80,
    deposit: 300,
    createdAt: addDays(0),
  },
];

export const seedContracts: Contract[] = [
  {
    id: "k1",
    clientName: "Mariana Lopes",
    cpf: "123.456.789-00",
    partyDate: addDays(8),
    theme: "Stitch",
    value: 980,
    deposit: 400,
    signed: true,
    signature: "Mariana Lopes",
    createdAt: addDays(-3),
  },
];

export const seedEvents: CalendarEvent[] = [
  { id: "e1", theme: "Stitch", clientName: "Mariana Lopes", date: addDays(8), setupTime: "08:00", pickupTime: "22:00", returnTime: addDays(9) + " 10:00" },
  { id: "e2", theme: "Encanto", clientName: "Beatriz Andrade", date: addDays(15), setupTime: "09:00", pickupTime: "21:00", returnTime: addDays(16) + " 09:00" },
  { id: "e3", theme: "Safari Baby", clientName: "Carolina Mendes", date: addDays(22), setupTime: "07:30", pickupTime: "20:00", returnTime: addDays(23) + " 11:00" },
];

export const seedTransactions: Transaction[] = [
  { id: "x1", type: "entrada", description: "Sinal festa Stitch", category: "Locação", client: "Mariana Lopes", amount: 400, date: addDays(-3), method: "Pix", status: "Pago" },
  { id: "x2", type: "entrada", description: "Pagamento final Princesas", category: "Locação", client: "Fernanda Rocha", amount: 1200, date: addDays(-5), method: "Cartão", status: "Pago" },
  { id: "x3", type: "entrada", description: "Restante festa Stitch", category: "Locação", client: "Mariana Lopes", amount: 580, date: addDays(7), method: "Pix", status: "Pendente" },
  { id: "x4", type: "entrada", description: "Festa Safari Baby", category: "Locação", client: "Carolina Mendes", amount: 850, date: addDays(22), method: "Pix", status: "Pendente" },
  { id: "x5", type: "saida", description: "Compra de balões", category: "Balões", amount: 220, date: addDays(-6), status: "Pago" },
  { id: "x6", type: "saida", description: "Impressão de painéis", category: "Impressão", amount: 180, date: addDays(-4), status: "Pago" },
  { id: "x7", type: "saida", description: "Combustível entregas", category: "Combustível", amount: 150, date: addDays(-2), status: "Pago" },
  { id: "x8", type: "saida", description: "Diária montadora", category: "Funcionários", amount: 200, date: addDays(-3), status: "Pago" },
  { id: "x9", type: "saida", description: "Peças tema novo", category: "Investimentos", amount: 600, date: addDays(-8), status: "Pago" },
];

export const seedTemplates: MessageTemplate[] = [
  {
    id: "m1",
    title: "Primeiro atendimento",
    emoji: "💕",
    body: "Oii, tudo bem? 💕 Que alegria seu interesse na nossa decoração Pegue e Monte! Me conta: qual a data da festa, o tema e a idade do aniversariante? Assim já monto um orçamento lindo pra você ✨",
  },
  {
    id: "m2",
    title: "Envio de orçamento",
    emoji: "🎀",
    body: "Prontinho! 🎀 Segue o orçamento da sua festa. Inclui painel, mesa decorada e arco de balões. Para garantir a data, reservamos com um sinal de 40%. Posso te enviar o contrato? 😊",
  },
  {
    id: "m3",
    title: "Cobrança de resposta",
    emoji: "🌸",
    body: "Oii! 🌸 Passando pra saber se você teve a chance de ver o orçamento. As datas estão preenchendo rapidinho e quero garantir a sua! Qualquer dúvida estou por aqui 💖",
  },
  {
    id: "m4",
    title: "Confirmação de pagamento",
    emoji: "✅",
    body: "Recebemos seu pagamento, muito obrigada! ✅ Sua data está oficialmente reservada 🎉 Em breve envio os detalhes da montagem. Vai ficar tudo lindo! ✨",
  },
  {
    id: "m5",
    title: "Confirmação de montagem",
    emoji: "🚚",
    body: "Oii! 🚚 Confirmando a montagem da sua festa amanhã. Nossa equipe chega no horário combinado. Deixe o espaço livre pra gente caprichar na decoração 💐",
  },
  {
    id: "m6",
    title: "Pós-venda",
    emoji: "🥰",
    body: "Esperamos que a festa tenha sido perfeita! 🥰 Foi um prazer fazer parte desse dia especial. Se puder, deixe seu feedback e marque a gente nas fotos no Instagram 📸💕 Até a próxima!",
  },
];
