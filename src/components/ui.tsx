import { type ReactNode, useEffect } from "react";
import { cn } from "../utils/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "glass rounded-3xl p-5 shadow-[0_8px_30px_-12px_rgba(169,143,224,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-stone-800 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnVariant = "primary" | "soft" | "ghost" | "gold" | "wa";
export function Button({
  children,
  onClick,
  variant = "primary",
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  className?: string;
  type?: "button" | "submit";
}) {
  const variants: Record<BtnVariant, string> = {
    primary:
      "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-lg shadow-lilac-200/60 hover:opacity-95",
    soft: "bg-white/70 text-stone-700 border border-white/80 hover:bg-white",
    ghost: "text-stone-600 hover:bg-white/60",
    gold: "bg-gradient-to-r from-gold-soft to-gold text-white shadow-lg shadow-gold-soft/40 hover:opacity-95",
    wa: "bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-lg shadow-green-200/60 hover:opacity-95",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = "lilac" }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    lilac: "bg-lilac-100 text-lilac-400",
    nude: "bg-nude-100 text-nude-500",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-500",
    gold: "bg-[#f6efdd] text-[#b08a36]",
    gray: "bg-stone-100 text-stone-500",
    blue: "bg-sky-50 text-sky-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        colors[color] ?? colors.lilac,
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={cn(
          "glass animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-800">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-stone-500 transition hover:bg-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-stone-200/80 bg-white/70 px-4 py-2.5 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-lilac-300 focus:ring-2 focus:ring-lilac-200/60";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-[90px] resize-y", props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "appearance-none", props.className)} />;
}
