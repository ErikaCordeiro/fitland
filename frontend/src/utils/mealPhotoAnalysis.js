export const MEAL_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const MEAL_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateMealPhoto(file) {
  if (!file) return "Selecione uma imagem para continuar.";
  if (!MEAL_PHOTO_TYPES.includes(file.type)) return "Use uma imagem JPEG, PNG ou WebP.";
  if (file.size > MEAL_PHOTO_MAX_BYTES) return "A imagem deve ter no máximo 5 MB.";
  return "";
}

export function formatFoodEstimate(food) {
  const unit = { g: "g", ml: "ml", unit: "unidade(s)", slice: "fatia(s)", portion: "porção(ões)" }[food.unit] || "";
  if (food.range_min != null && food.range_max != null) {
    return `aprox. ${food.range_min}-${food.range_max} ${unit}`.trim();
  }
  if (food.estimated_amount != null) return `aprox. ${food.estimated_amount} ${unit}`.trim();
  return "Quantidade não estimável com segurança";
}

export function confidenceLabel(value) {
  return { high: "Confiança alta", medium: "Confiança média", low: "Confiança baixa" }[value] || "Confiança não informada";
}
