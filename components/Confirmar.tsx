"use client";
// Botão de envio que pede confirmação antes (usado em exclusões)
export default function Confirmar({ texto, className, children }: { texto: string; className?: string; children: React.ReactNode }) {
  return <button className={className} onClick={(e) => { if (!confirm(texto)) e.preventDefault(); }}>{children}</button>;
}
