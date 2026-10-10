"use client";
// Botão de envio que pede confirmação antes (usado em exclusões). formAction opcional para usar dentro de outro formulário.
export default function Confirmar({ texto, className, children, formAction }: { texto: string; className?: string; children: React.ReactNode; formAction?: (fd: FormData) => void | Promise<void> }) {
  return <button className={className} formAction={formAction} onClick={(e) => { if (!confirm(texto)) e.preventDefault(); }}>{children}</button>;
}
