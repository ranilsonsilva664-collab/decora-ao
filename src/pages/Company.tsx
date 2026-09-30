import { useState, useRef, useEffect } from "react";
import { Card, SectionTitle, Button, Field, Input, Textarea, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import { compressImage } from "../utils/image";

export default function Company() {
  const { companySettings, setCompanySettings, tenantId, currentTenant, updateTenantSecretKey, logAction } = useStore();
  const toast = useToast();

  const [settings, setSettings] = useState(companySettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState("");
  const [confirmSecretKey, setConfirmSecretKey] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Sync with store when data loads from Firestore
  useEffect(() => {
    if (companySettings) {
      setSettings(companySettings);
    }
  }, [companySettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    toast("Processando logo...");
    try {
      // Compress to lightweight high-res base64 (max 400px -> ~20KB)
      const base64 = await compressImage(file, 400, 0.82);

      const updated = { ...settings, logo: base64 };
      setSettings(updated);
      setCompanySettings(updated);
      logAction("Logo Atualizada", "Nova logo da empresa configurada");
      toast("Logo atualizada e salva com sucesso! ✨");
    } catch (err) {
      console.error("Erro ao carregar logo:", err);
      toast("Erro ao processar imagem. Tente um arquivo JPG ou PNG.");
    } finally {
      setUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    const updated = { ...settings, logo: "" };
    setSettings(updated);
    setCompanySettings(updated);
    toast("Logo removida com sucesso");
  };

  const handleSave = () => {
    if (!settings.name.trim()) return toast("Informe o nome da sua empresa");

    setSaving(true);
    setCompanySettings(settings);
    logAction("Dados da Empresa Atualizados", settings.name);
    setSaving(false);
    toast("Configurações da empresa salvas com sucesso!");
  };

  const handleCepLookup = async (cepVal: string) => {
    const clean = cepVal.replace(/\D/g, "");
    setSettings((prev) => ({ ...prev, cep: cepVal }));
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const d = await res.json();
        if (!d.erro) {
          setSettings((prev) => ({
            ...prev,
            address: d.logradouro || prev.address,
            neighborhood: d.bairro || prev.neighborhood,
            city: d.localidade || prev.city,
            state: d.uf || prev.state,
          }));
          toast("Endereço preenchido pelo CEP!");
        }
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionTitle
        title="Minha Empresa & Identidade Visual"
        subtitle="Configure os dados da RAYDECOR utilizados nos contratos, orçamentos e recibos em PDF"
        action={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        }
      />

      {/* Logo & Visual Identity */}
      <Card>
        <p className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-4">
          Logo e Marca da Empresa
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative h-28 w-28 shrink-0 rounded-3xl bg-white p-2 border-2 border-dashed border-lilac-300 shadow-lg shadow-lilac-100 flex items-center justify-center overflow-hidden">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className="h-full w-full object-cover rounded-2xl" />
            ) : (
              <span className="text-3xl">🎀</span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-lilac-200 border-t-lilac-500" />
              </div>
            )}
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <input
              type="file"
              accept="image/*"
              ref={logoInputRef}
              onChange={handleLogoUpload}
              className="hidden"
              disabled={uploading}
            />
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Button
                variant="soft"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading}
              >
                <Icon.up className="h-4 w-4" /> {settings.logo ? "Alterar Logo" : "Adicionar Logo"}
              </Button>
              {settings.logo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition"
                >
                  Remover Logo
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Formato recomendado: PNG ou JPG quadrado (ex: 500x500px). Aparece automaticamente nos
              orçamentos, contratos e recibos.
            </p>
          </div>
        </div>
      </Card>

      {/* Basic Info */}
      <Card className="space-y-4">
        <p className="text-sm font-bold text-stone-800 uppercase tracking-wider">
          Dados Cadastrais da Empresa
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da Empresa (Razão Social)">
            <Input
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              placeholder="Ex: RAYDECOR Locações e Decorações"
            />
          </Field>

          <Field label="Nome Fantasia / Marca">
            <Input
              value={settings.tradeName}
              onChange={(e) => setSettings({ ...settings, tradeName: e.target.value })}
              placeholder="Ex: RAYDECOR"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="CNPJ ou CPF">
            <Input
              value={settings.cnpjCpf || ""}
              onChange={(e) => setSettings({ ...settings, cnpjCpf: e.target.value })}
              placeholder="00.000.000/0001-00"
            />
          </Field>

          <Field label="Responsável Legal">
            <Input
              value={settings.ownerName || ""}
              onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
              placeholder="Nome da proprietária"
            />
          </Field>

          <Field label="E-mail de Contato">
            <Input
              value={settings.email || ""}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="contato@raydecor.com.br"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp Comercial">
            <Input
              value={settings.whatsapp || ""}
              onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
              placeholder="11999999999"
            />
          </Field>

          <Field label="Telefone Fixo / Adicional">
            <Input
              value={settings.phone || ""}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              placeholder="1133334444"
            />
          </Field>
        </div>
      </Card>

      {/* Endereço */}
      <Card className="space-y-4">
        <p className="text-sm font-bold text-stone-800 uppercase tracking-wider">
          Endereço Físico / Retirada do Acervo
        </p>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="CEP (busca automática)">
            <Input
              value={settings.cep || ""}
              onChange={(e) => handleCepLookup(e.target.value)}
              placeholder="00000-000"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Rua / Avenida">
              <Input
                value={settings.address || ""}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Rua..."
              />
            </Field>
          </div>
          <Field label="Número">
            <Input
              value={settings.number || ""}
              onChange={(e) => setSettings({ ...settings, number: e.target.value })}
              placeholder="123"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Complemento">
            <Input
              value={settings.complement || ""}
              onChange={(e) => setSettings({ ...settings, complement: e.target.value })}
              placeholder="Galpão, Sala..."
            />
          </Field>
          <Field label="Bairro">
            <Input
              value={settings.neighborhood || ""}
              onChange={(e) => setSettings({ ...settings, neighborhood: e.target.value })}
              placeholder="Bairro"
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="Cidade">
                <Input
                  value={settings.city || ""}
                  onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                  placeholder="Cidade"
                />
              </Field>
            </div>
            <Field label="UF">
              <Input
                value={settings.state || "SP"}
                onChange={(e) => setSettings({ ...settings, state: e.target.value.toUpperCase() })}
                placeholder="UF"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Dados Bancários e PIX */}
      <Card className="space-y-4">
        <p className="text-sm font-bold text-stone-800 uppercase tracking-wider">
          Dados Bancários & Chave PIX (Para Recebimentos)
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tipo da Chave PIX">
            <Select
              value={settings.pixType || "Chave Aleatória"}
              onChange={(e) => setSettings({ ...settings, pixType: e.target.value as any })}
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="E-mail">E-mail</option>
              <option value="Telefone">Telefone</option>
              <option value="Chave Aleatória">Chave Aleatória</option>
            </Select>
          </Field>

          <Field label="Chave PIX">
            <Input
              value={settings.pixKey || ""}
              onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })}
              placeholder="Sua chave PIX"
            />
          </Field>

          <Field label="Banco / Instituição">
            <Input
              value={settings.bankName || ""}
              onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
              placeholder="Ex: Nubank, Itaú..."
            />
          </Field>
        </div>
      </Card>

      {/* Cláusulas Padrão */}
      <Card className="space-y-3">
        <p className="text-sm font-bold text-stone-800 uppercase tracking-wider">
          Termos e Cláusulas Gerais de Locação
        </p>
        <p className="text-xs text-stone-500">
          Este texto será inserido como cláusula padrão em todos os novos contratos gerados.
        </p>
        <Textarea
          rows={8}
          value={settings.terms || ""}
          onChange={(e) => setSettings({ ...settings, terms: e.target.value })}
        />
      </Card>

      {/* Chave de Acesso & Privacidade Comercial */}
      <Card className="space-y-4 border-2 border-lilac-200 bg-gradient-to-br from-white to-pink-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔐</span>
              <h3 className="text-base font-bold text-stone-800">
                Chave de Acesso & Privacidade dos Seus Dados
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Para sua total privacidade e confiança, você pode definir uma <b>chave secreta particular</b> só sua. Nem mesmo os administradores do sistema terão acesso a esta chave após redefini-la.
            </p>
          </div>
          {currentTenant?.hasCustomKey && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              ✓ Chave Privada Ativa
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-white/70 p-4 border border-stone-200/60 text-xs">
          <div>
            <p className="text-stone-400 font-semibold uppercase text-[10px]">Identificador da Conta</p>
            <p className="font-mono font-bold text-stone-800 text-sm mt-0.5">{tenantId}</p>
          </div>
          <div>
            <p className="text-stone-400 font-semibold uppercase text-[10px]">Plano Atual & Validade</p>
            <p className="font-bold text-purple-700 text-sm mt-0.5">
              {currentTenant?.planType === "annual"
                ? "Plano Anual"
                : currentTenant?.planType === "monthly"
                ? "Plano Mensal"
                : currentTenant?.isTest
                ? "Teste 24h"
                : "Assinatura Ativa"}{" "}
              {currentTenant?.expiresAt && `(Até ${new Date(currentTenant.expiresAt).toLocaleDateString("pt-BR")})`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-pink-100 space-y-3">
          <p className="text-xs font-bold text-stone-700">
            {currentTenant?.hasCustomKey ? "Redefinir Minha Chave Secreta:" : "Criar Minha Chave Secreta Particular:"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nova Chave Secreta (mín. 4 caracteres)">
              <Input
                type="text"
                placeholder="Ex: MINHASENHA99"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
              />
            </Field>
            <Field label="Confirmar Nova Chave">
              <Input
                type="text"
                placeholder="Digite a mesma chave"
                value={confirmSecretKey}
                onChange={(e) => setConfirmSecretKey(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="soft"
              disabled={savingSecret || !newSecretKey.trim()}
              onClick={async () => {
                if (!newSecretKey.trim()) return toast("Informe a nova chave secreta");
                if (newSecretKey.trim().length < 4) return toast("A chave deve ter no mínimo 4 caracteres");
                if (newSecretKey.trim() !== confirmSecretKey.trim()) return toast("As duas chaves digitadas não conferem!");

                setSavingSecret(true);
                try {
                  const res = await updateTenantSecretKey(newSecretKey.trim());
                  if (res.success) {
                    toast("🔒 Chave secreta particular salva com sucesso!");
                    setNewSecretKey("");
                    setConfirmSecretKey("");
                  } else {
                    toast(res.error || "Erro ao salvar chave");
                  }
                } catch {
                  toast("Erro ao salvar chave");
                } finally {
                  setSavingSecret(false);
                }
              }}
            >
              {savingSecret ? "Salvando Chave..." : "Salvar Chave Secreta Particular 🔒"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="px-8 py-3 text-base">
          {saving ? "Salvando..." : "Salvar Configurações da Empresa ✨"}
        </Button>
      </div>
    </div>
  );
}
