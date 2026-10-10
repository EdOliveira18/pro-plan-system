import { redirect } from "next/navigation";
// A lista de clientes agora fica em Cadastros
export default function Clientes() { redirect("/cadastros/clientes"); }
