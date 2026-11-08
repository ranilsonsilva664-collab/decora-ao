import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, authReady } from "../lib/firebase";
import type { TenantData, Client, EventModel, PublicFormSubmission, Contract, CalendarEvent } from "../lib/types";
import { uid, fmtDate } from "../lib/format";
import { waLink } from "../lib/helpers";
import { sanitizeContract } from "../lib/firestoreUtils";

export default function PublicForm({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Pegue e Monte");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWhatsapp, setCompanyWhatsapp] = useState("");
  const [companyLogo, setCompanyLogo] = useState(
    "https://res.cloudinary.com/dmxeqe939/image/upload/v1785097595/ChatGPT_Image_26_de_jul._de_2026_17_25_48_ilxojd.png"
  );
  const [error, setError] = useState("");

  // Form Fields - Cliente
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");

  // Form Fields - Evento
  const [eventType, setEventType] = useState("Aniversário");
  const [birthdayPerson, setBirthdayPerson] = useState("");
  const [age, setAge] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("14:00");
  const [theme, setTheme] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Pagamento 50% via Pix
  const [pixPaymentOption, setPixPaymentOption] = useState<"pagar_50_pix" | "ja_paguei_50_pix">("pagar_50_pix");
  const [copiedPix, setCopiedPix] = useState(false);
  const PIX_KEY = "81997264363";
  const PIX_HOLDER = "Francisco de Assis da Silva";

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  useEffect(() => {
    async function loadTenant() {
      try {
        await authReady;
        const snap = await getDoc(doc(db, "tenant_data", tenantId));
        if (snap.exists()) {
          const tData = snap.data() as Partial<TenantData>;
          if (tData.companySettings) {
            if (tData.companySettings.tradeName || tData.companySettings.name) {
              setCompanyName(tData.companySettings.tradeName || tData.companySettings.name || "Pegue e Monte");
            }
            if (tData.companySettings.logo) setCompanyLogo(tData.companySettings.logo);
            if (tData.companySettings.whatsapp) setCompanyWhatsapp(tData.companySettings.whatsapp);
            if (tData.companySettings.phone) setCompanyPhone(tData.companySettings.phone);
          }
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, [tenantId]);

  const handleCepLookup = async (cepVal: string) => {
    const cleanCep = cepVal.replace(/\D/g, "");
    setCep(cepVal);
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const d = await res.json();
        if (!d.erro) {
          setAddress(d.logradouro || address);
          setNeighborhood(d.bairro || neighborhood);
          setCity(d.localidade || city);
          setState(d.uf || state);
        }
      } catch {
        // Ignore
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim() || !eventDate.trim() || !theme.trim()) {
      setError("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await authReady;
      const snap = await getDoc(doc(db, "tenant_data", tenantId));
      let currentData: Partial<TenantData> = {};
      if (snap.exists()) {
        currentData = snap.data() as Partial<TenantData>;
      }

      const existingClients = currentData.clients || [];
      const existingEvents = currentData.eventsList || [];
      const existingSubmissions = currentData.formSubmissions || [];
      const existingLogs = currentData.actionLogs || [];

      // 1. Create or update Client
      const existingClientIdx = existingClients.findIndex(
        (c) =>
          c.whatsapp.replace(/\D/g, "") === whatsapp.replace(/\D/g, "") ||
          c.name.toLowerCase() === name.toLowerCase()
      );

      const clientId = existingClientIdx >= 0 ? existingClients[existingClientIdx].id : uid();
      const updatedClient: Client = {
        id: clientId,
        name: name.trim(),
        cpf: cpf.trim(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        email: email.trim(),
        cep: cep.trim(),
        address: address.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
        notes: notes.trim(),
        photos: [],
        status: "Novo orçamento",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const newClients =
        existingClientIdx >= 0
          ? existingClients.map((c, i) => (i === existingClientIdx ? updatedClient : c))
          : [updatedClient, ...existingClients];

      // 2. Create Event
      const newEvent: EventModel = {
        id: uid(),
        clientId,
        clientName: name.trim(),
        type: eventType as any,
        birthdayPerson: birthdayPerson.trim(),
        age: age.trim(),
        theme: theme.trim(),
        date: eventDate,
        time: eventTime,
        location: eventLocation.trim() || `${address} ${number} ${city}`,
        pickupDate: eventDate,
        pickupTime: "09:00",
        returnDate: new Date(new Date(eventDate).getTime() + 86400000).toISOString().slice(0, 10),
        returnTime: "12:00",
        status: "Orçamento",
        items: [],
        notes: `Enviado pelo formulário online. ${notes}`,
        createdAt: new Date().toISOString(),
      };

      // 3. GENERATE CONTRACT AUTOMATICALLY FROM FORM DATA
      const contractId = uid();
      const existingContracts = currentData.contracts || [];
      const fullResAddress = [
        address.trim(),
        number.trim() ? `nº ${number.trim()}` : "",
        complement.trim(),
        neighborhood.trim(),
        city.trim(),
        state.trim(),
      ]
        .filter(Boolean)
        .join(", ");

      const resolvedPartyLocation = eventLocation.trim() || fullResAddress;

      const pixNoteText =
        pixPaymentOption === "ja_paguei_50_pix"
          ? "[Pagamento: Cliente informou que JÁ REALIZOU os 50% via Pix (Chave 81997264363 - Francisco de Assis da Silva)]"
          : "[Pagamento: Opção selecionada de 50% via Pix para garantir a data (Chave 81997264363 - Francisco de Assis da Silva)]";
      const combinedNotes = [notes.trim(), pixNoteText].filter(Boolean).join(" | ");

      const newContract: Contract = sanitizeContract({
        id: contractId,
        clientId,
        clientName: name.trim(),
        whatsapp: whatsapp.trim(),
        clientPhone: whatsapp.trim(),
        cpf: cpf.trim(),
        email: email.trim(),
        cep: cep.trim(),
        address: address.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
        eventId: newEvent.id,
        eventType: eventType.trim(),
        birthdayPerson: birthdayPerson.trim(),
        age: age.trim(),
        partyDate: eventDate,
        partyTime: eventTime,
        partyLocation: resolvedPartyLocation,
        notes: combinedNotes,
        theme: theme.trim(),
        items: [],
        value: 0,
        deposit: 0,
        delivery: 0,
        assembly: 0,
        discount: 0,
        pickupDate: eventDate,
        pickupTime: "09:00",
        returnDate: new Date(new Date(eventDate).getTime() + 86400000).toISOString().slice(0, 10),
        returnTime: "12:00",
        signed: false,
        signature: "",
        status: "Pendente",
        customTerms: currentData.companySettings?.terms || currentData.contractRules || "",
        createdAt: new Date().toISOString().slice(0, 10),
      });

      // 4. Create Submission record
      const newSubmission: PublicFormSubmission = {
        id: uid(),
        contractId,
        clientId,
        clientName: name.trim(),
        cpf: cpf.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        cep: cep.trim(),
        address: address.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
        eventType: eventType as any,
        birthdayPerson: birthdayPerson.trim(),
        age: age.trim(),
        eventDate,
        eventTime,
        eventLocation: resolvedPartyLocation,
        theme: theme.trim(),
        notes: combinedNotes,
        status: "Novo",
        createdAt: new Date().toISOString(),
      };

      const newLog = {
        id: uid(),
        timestamp: new Date().toISOString(),
        action: "Formulário e Contrato Recebidos",
        details: `${name.trim()} preencheu formulário e gerou contrato automático #${contractId} para a festa ${theme.trim()} em ${eventDate}`,
        user: "Cliente (Online)",
      };

      // Agenda automática no calendário na data preenchida
      const existingCalendarEvents = currentData.events || [];
      const newCalendarEvent: CalendarEvent = {
        id: uid(),
        theme: theme.trim() || "Decoração Pegue e Monte",
        clientName: name.trim(),
        date: eventDate,
        setupTime: eventTime || "09:00",
        pickupTime: "09:00",
        returnTime: "12:00",
      };

      // Sanitizar listas existentes para remover base64 que possam exceder limite do Firestore
      const sanitizedExistingClients = newClients.map((c) => ({
        ...c,
        photos: (c.photos || []).filter((p: string) => !p.startsWith("data:image")),
      }));

      const sanitizedExistingContracts = [newContract, ...existingContracts].map((c) => {
        // Remove qualquer campo que possa conter base64 de sessões anteriores
        return c;
      });

      // 1. Dual-save contract to public_contracts for 100% reliable public signing
      try {
        await setDoc(
          doc(db, "public_contracts", `${tenantId}_${newContract.id}`),
          {
            ...newContract,
            tenantId,
            companySettings: currentData.companySettings || {},
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Aviso ao salvar public_contracts:", err);
      }

      // 2. Dual-save submission to public_submissions for 100% reliable tracking
      try {
        await setDoc(
          doc(db, "public_submissions", `${tenantId}_${newSubmission.id}`),
          {
            ...newSubmission,
            tenantId,
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Aviso ao salvar public_submissions:", err);
      }

      // 3. Sincroniza tenant_data da empresa
      try {
        await setDoc(
          doc(db, "tenant_data", tenantId),
          {
            clients: sanitizedExistingClients,
            eventsList: [newEvent, ...existingEvents],
            events: [newCalendarEvent, ...existingCalendarEvents],
            contracts: sanitizedExistingContracts,
            formSubmissions: [newSubmission, ...existingSubmissions],
            actionLogs: [newLog, ...existingLogs].slice(0, 100),
          },
          { merge: true }
        );
      } catch (tdErr) {
        console.warn("Aviso ao sincronizar tenant_data:", tdErr);
      }

      setCreatedContractId(contractId);
      setSubmitted(true);
    } catch (err: any) {
      console.error("Erro ao enviar formulário:", err);
      // Identifica erros comuns do Firestore
      const msg = err?.message || "";
      if (msg.includes("exceeds maximum size") || msg.includes("RESOURCE_EXHAUSTED")) {
        setError(
          "Erro: o banco de dados da empresa está cheio (limite de armazenamento excedido). " +
          "Por favor, entre em contato com a empresa para resolver este problema."
        );
      } else if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) {
        setError("Erro de permissão. O formulário não está autorizado a gravar dados. Contate a empresa.");
      } else {
        setError("Ocorreu um erro ao enviar seus dados. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf8fa]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
          <p className="font-medium text-sm">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const signUrl = createdContractId
      ? `${window.location.origin}/assinar/${tenantId}/${createdContractId}`
      : null;
    const companyContact = companyWhatsapp || companyPhone;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] to-[#faf5ff] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl text-center border border-white space-y-5 animate-rise">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-4xl shadow-lg shadow-emerald-200">
            ✍️
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Contrato Gerado com Sucesso!</h2>
            <p className="mt-2 text-sm text-stone-600">
              Recebemos seus dados, <b>{name}</b>! O seu cadastro e o <b>Contrato de Locação</b> para a festa com o tema <b>{theme}</b> já foram gerados automaticamente no sistema da <b>{companyName}</b>.
            </p>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 p-4 text-xs text-left border border-pink-100/80 space-y-2">
            <div className="flex justify-between border-b border-pink-100/60 pb-1.5">
              <span className="text-stone-500">Contratante:</span>
              <span className="font-semibold text-stone-800">{name}</span>
            </div>
            <div className="flex justify-between border-b border-pink-100/60 pb-1.5">
              <span className="text-stone-500">WhatsApp:</span>
              <span className="font-semibold text-stone-800">{whatsapp}</span>
            </div>
            <div className="flex justify-between border-b border-pink-100/60 pb-1.5">
              <span className="text-stone-500">Tema:</span>
              <span className="font-semibold text-stone-800">{theme}</span>
            </div>
            <div className="flex justify-between border-b border-pink-100/60 pb-1.5">
              <span className="text-stone-500">Data da Festa:</span>
              <span className="font-semibold text-stone-800">{fmtDate(eventDate)}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-stone-500">Status do Contrato:</span>
              <span className="font-bold text-amber-600">Aguardando Assinatura Digital</span>
            </div>
          </div>

          {/* Box de Pagamento dos 50% via Pix na Tela de Confirmação */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-left border-2 border-emerald-200 space-y-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white text-base font-bold">
                💠
              </span>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                  Garantia de Reserva — Pagamento de 50% via Pix
                </h3>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5 leading-snug">
                  Agendamento mediante pagamento de 50%. Pagando os 50% sua data está <b>100% garantida</b>!
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 border border-emerald-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Chave Pix (Celular):</span>
                <span className="font-black text-stone-900 text-sm tracking-wide">{PIX_KEY}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Favorecido:</span>
                <span className="font-bold text-stone-800">{PIX_HOLDER}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyPix}
              className="w-full rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
            >
              {copiedPix ? "✅ Chave Pix Copiada! (81997264363)" : "📋 Copiar Chave Pix: 81997264363"}
            </button>
          </div>

          <div className="space-y-2.5 pt-2">
            {signUrl && (
              <a
                href={signUrl}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 px-5 text-sm font-bold text-white shadow-lg shadow-pink-200 hover:opacity-95 transition"
              >
                ✍️ Assinar Meu Contrato Online Agora
              </a>
            )}

            <a
              href={waLink(
                companyContact || PIX_KEY,
                `Olá! Acabei de enviar o formulário para a festa *${theme}* (${name}) na data *${fmtDate(
                  eventDate
                )}* e vou enviar o comprovante dos 50% via Pix para garantir 100% minha data! 💕`
              )}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 px-5 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-600 transition"
            >
              💬 Enviar Comprovante do Pix no WhatsApp
            </a>
          </div>

          <p className="text-[11px] text-stone-400">
            A equipe da {companyName} também entrará em contato pelo seu WhatsApp {whatsapp} para alinhar todos os detalhes! ✨
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] via-[#faf5ff] to-[#f8fafc] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-xl">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-1 shadow-lg shadow-pink-200/50">
            <img src={companyLogo} alt="Logo" className="h-full w-full rounded-xl object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-800 sm:text-3xl">
            {companyName}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Preencha os dados abaixo para receber seu orçamento personalizado ✨
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Dados da Cliente */}
          <div className="rounded-3xl bg-white/80 p-6 backdrop-blur-xl shadow-xl shadow-pink-100/50 border border-white/80 space-y-4">
            <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-pink-100 text-pink-600 text-xs font-bold">
                1
              </span>
              Seus Dados Pessoais
            </h2>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Seu Nome Completo *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mariana Lopes da Silva"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  WhatsApp com DDD *
                </label>
                <input
                  required
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">CPF (opcional)</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">E-mail (opcional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
              />
            </div>

            {/* Endereço */}
            <div className="pt-2 border-t border-stone-100 space-y-3">
              <p className="text-xs font-bold text-stone-600">Endereço Residencial</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    CEP (busca automática)
                  </label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => handleCepLookup(e.target.value)}
                    placeholder="00000-000"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Número</label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Logradouro / Rua</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, Avenida..."
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Complemento</label>
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto, Bloco..."
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">UF</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-pink-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Dados do Evento */}
          <div className="rounded-3xl bg-white/80 p-6 backdrop-blur-xl shadow-xl shadow-pink-100/50 border border-white/80 space-y-4">
            <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-purple-100 text-purple-600 text-xs font-bold">
                2
              </span>
              Dados da Sua Festa
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Tipo de Evento</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
                >
                  <option>Aniversário</option>
                  <option>Chá revelação</option>
                  <option>Chá de bebê</option>
                  <option>Batizado</option>
                  <option>Casamento</option>
                  <option>Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Tema Desejado *
                </label>
                <input
                  required
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ex: Stitch, Safari, Princesas..."
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Nome do Aniversariante
                </label>
                <input
                  type="text"
                  value={birthdayPerson}
                  onChange={(e) => setBirthdayPerson(e.target.value)}
                  placeholder="Ex: Pedro"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Idade que fará</label>
                <input
                  type="text"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ex: 5 anos"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Data da Festa *
                </label>
                <input
                  required
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Horário Previsto</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Endereço ou Local da Festa
              </label>
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Rua, condomínio ou salão de festas..."
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Observações, Cores ou Pedidos Especiais
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Conte-nos como você imagina a decoração..."
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400"
              />
            </div>
          </div>

          {/* Seção 3: Pagamento dos 50% pelo Pix e Garantia da Data */}
          <div className="rounded-3xl bg-white/90 p-6 backdrop-blur-xl shadow-xl shadow-emerald-100/60 border-2 border-emerald-200 space-y-4">
            <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold">
                3
              </span>
              Pagamento dos 50% via Pix (Reserva da Data)
            </h2>

            {/* Aviso importante de 50% */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-md shadow-emerald-200/70">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">🔒</span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                    Garantia de Agendamento
                  </p>
                  <p className="text-sm font-bold leading-snug mt-0.5">
                    Agendamento mediante pagamento de 50% — pagando os 50% sua data está 100% garantida!
                  </p>
                </div>
              </div>
            </div>

            {/* Opção de Pagamento pelo Pix */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                Selecione a opção de pagamento do sinal (50% via Pix):
              </label>

              <label
                onClick={() => setPixPaymentOption("pagar_50_pix")}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                  pixPaymentOption === "pagar_50_pix"
                    ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="pixPaymentOption"
                  checked={pixPaymentOption === "pagar_50_pix"}
                  onChange={() => setPixPaymentOption("pagar_50_pix")}
                  className="mt-1 accent-emerald-600"
                />
                <div className="text-xs">
                  <p className="font-bold text-stone-800">
                    💠 Pagar 50% de Sinal pelo Pix (Garantir 100% a minha data)
                  </p>
                  <p className="text-stone-500 mt-0.5">
                    Copie a chave Pix abaixo para realizar o pagamento dos 50% do sinal e garantir sua reserva.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setPixPaymentOption("ja_paguei_50_pix")}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                  pixPaymentOption === "ja_paguei_50_pix"
                    ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="pixPaymentOption"
                  checked={pixPaymentOption === "ja_paguei_50_pix"}
                  onChange={() => setPixPaymentOption("ja_paguei_50_pix")}
                  className="mt-1 accent-emerald-600"
                />
                <div className="text-xs">
                  <p className="font-bold text-stone-800">
                    ✅ Já realizei o pagamento dos 50% via Pix
                  </p>
                  <p className="text-stone-500 mt-0.5">
                    Já fiz o Pix de 50% e enviarei o comprovante pelo WhatsApp após finalizar.
                  </p>
                </div>
              </label>
            </div>

            {/* Card com a Chave Pix e Nome do Titular */}
            <div className="rounded-2xl bg-emerald-50/90 border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <span>💠</span> Dados para Pagamento Pix (50%)
                </span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  Reserva 100% Garantida
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-white p-3 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block">
                    Chave Pix (Telefone/Celular)
                  </span>
                  <span className="text-base font-black text-emerald-700 tracking-wide mt-0.5 block">
                    {PIX_KEY}
                  </span>
                </div>

                <div className="rounded-xl bg-white p-3 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block">
                    Nome / Favorecido
                  </span>
                  <span className="text-sm font-extrabold text-stone-800 mt-0.5 block">
                    {PIX_HOLDER}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-extrabold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 transition active:scale-98 cursor-pointer"
              >
                {copiedPix ? "✅ Chave Pix 81997264363 Copiada!" : "📋 Copiar Chave Pix (81997264363)"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 p-4 text-xs font-medium text-rose-600 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-400 to-purple-500 py-4 font-bold text-white shadow-xl shadow-pink-200 transition hover:opacity-95 disabled:opacity-50 text-base"
          >
            {saving ? "Enviando Informações..." : "Enviar e Solicitar Orçamento 💕"}
          </button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-6">
          Seus dados estão protegidos • {companyName}
        </p>
      </div>
    </div>
  );
}
