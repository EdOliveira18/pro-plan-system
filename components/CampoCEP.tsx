"use client";
// Ao sair do campo CEP, busca o endereço nos Correios (ViaCEP) e preenche os campos vazios do mesmo formulário.
export default function CampoCEP({ defaultValue, required }: { defaultValue?: string; required?: boolean }) {
  return (
    <input name="cep" inputMode="numeric" defaultValue={defaultValue} required={required} placeholder="00000-000"
      onBlur={async (ev) => {
        const cep = ev.currentTarget.value.replace(/\D/g, "");
        const form = ev.currentTarget.form;
        if (cep.length !== 8 || !form) return;
        ev.currentTarget.value = cep.slice(0, 5) + "-" + cep.slice(5);
        try {
          const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const d = await r.json();
          if (d.erro) return;
          const por: Record<string, string> = { logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf, complemento: d.complemento };
          for (const [n, v] of Object.entries(por)) {
            const el = form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
            if (el && v && !el.value) el.value = v;
          }
          (form.elements.namedItem("numero") as HTMLInputElement | null)?.focus();
        } catch { /* sem internet ou CEP inexistente: usuário preenche à mão */ }
      }} />
  );
}
