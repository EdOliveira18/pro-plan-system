// Instruções enviadas à IA de imagem. Em inglês porque os modelos seguem melhor; os detalhes do cliente entram como texto livre.
export const ESTILOS: Record<string, string> = {
  contemporaneo: "contemporary style, light neutral palette, matte lacquer and light wood veneer",
  amadeirado: "warm style dominated by natural wood veneer, earthy tones",
  industrial: "industrial style, dark tones, black metal details, concrete-like surfaces",
  classico: "classic elegant style, frame-and-panel doors, soft beige and white",
  minimalista: "minimalist style, handleless doors, white and grey, clean lines",
};

export function promptRender(tipo: "planta" | "promob", ambiente: string, estilo: string, instrucoes: string) {
  const est = ESTILOS[estilo] ?? ESTILOS.contemporaneo;
  const extra = instrucoes?.trim() ? ` Additional client requests: ${instrucoes.trim()}.` : "";
  if (tipo === "planta") {
    return (
      `This image is an architect's 2D floor plan. Create a photorealistic 3D rendering of the ${ambiente || "space"} shown in it, ` +
      `as a high-angle three-quarter perspective cutaway view (dollhouse style, no ceiling) that faithfully follows the plan's walls, ` +
      `door and window openings, proportions and furniture layout. Furnish it with custom-made built-in furniture (Brazilian "móveis planejados": ` +
      `kitchen cabinets, wardrobes, panels, countertops) in a ${est}. Realistic materials, soft natural daylight, interior design magazine quality. ` +
      `Do not draw text, dimensions, labels or watermarks.${extra}`
    );
  }
  return (
    `This image is a 3D view exported from Promob furniture design software. Turn it into a photorealistic interior photograph of the ${ambiente || "room"}, ` +
    `keeping exactly the same camera angle, room layout, furniture geometry, proportions, colors and finishes. Improve material realism, ` +
    `add natural lighting, reflections, soft shadows and subtle decoration. Never change the furniture design. Mood: ${est}. ` +
    `Do not draw text or watermarks.${extra}`
  );
}
