import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM com chave derivada de CERT_SECRET (variável só do servidor)
function chave() {
  const s = process.env.CERT_SECRET;
  if (!s || s.length < 32) throw new Error("CERT_SECRET não configurado no servidor.");
  return createHash("sha256").update(s).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decifrar(pacote: string): string {
  const [iv, tag, enc] = pacote.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
