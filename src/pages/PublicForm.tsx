import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TenantData, Client, EventModel, PublicFormSubmission } from "../lib/types";
import { uid } from "../lib/format";

export default function PublicForm({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companyName, setCompanyName] = useState("RAYDECOR Pegue e Monte");
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

  useEffect(() => {
    async function loadTenant() {
      try {
        const snap = await getDoc(doc(db, "tenant_data", tenantId));
        if (snap.exists()) {
          const tData = snap.data() as Partial<TenantData>;
          if (tData.companySettings) {
            if (tData.companySettings.name) setCompanyName(tData.companySettings.name);
            if (tData.companySettings.logo) setCompanyLogo(tData.companySettings.logo);
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

      // 3. Create Submission record
      const newSubmission: PublicFormSubmission = {
        id: uid(),
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
        theme: theme.trim(),
        notes: notes.trim(),
        status: "Novo",
        createdAt: new Date().toISOString(),
      };

      const newLog = {
        id: uid(),
        timestamp: new Date().toISOString(),
        action: "Formulário Recebido",
        details: `${name.trim()} preencheu formulário para a festa ${theme.trim()} em ${eventDate}`,
        user: "Cliente (Online)",
      };

      // Save everything to Firestore
      await setDoc(
        doc(db, "tenant_data", tenantId),
        {
          clients: newClients,
          eventsList: [newEvent, ...existingEvents],
          formSubmissions: [newSubmission, ...existingSubmissions],
          actionLogs: [newLog, ...existingLogs].slice(0, 100),
        },
        { merge: true }
      );

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Ocorreu um erro ao enviar seus dados. Por favor, tente novamente.");
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] to-[#faf5ff] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl text-center border border-white">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-3xl">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-stone-800">Formulário Enviado!</h2>
          <p className="mt-2 text-sm text-stone-600">
            Recebemos todas as informações da sua festa, <b>{name}</b>! Já estamos preparando o seu
            orçamento com muito carinho.
          </p>
          <div className="mt-6 rounded-2xl bg-pink-50 p-4 text-xs text-pink-700">
            Entraremos em contato pelo seu WhatsApp <b>{whatsapp}</b> em breve 💕
          </div>
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

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Logradouro / Rua</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Avenida..."
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none focus:border-pink-400"
                />
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
