import React, { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, RefreshCw, Sparkles, Upload } from "lucide-react";
import { apiRequest } from "../services/api.js";
import { confidenceLabel, formatFoodEstimate, validateMealPhoto } from "../utils/mealPhotoAnalysis.js";

const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: "A análise por IA não está disponível no momento.",
  AI_PROVIDER_ERROR: "Não foi possível analisar a imagem agora. Tente novamente mais tarde.",
  AI_INVALID_RESPONSE: "A análise não retornou um resultado confiável. Tente outra foto.",
  AI_DAILY_LIMIT_REACHED: "O limite diário de análises foi atingido.",
};

export default function MealPhotoAnalyzer() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    const validationError = validateMealPhoto(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFile(null);
    setResult(null);
    setError(validationError);
    setState(validationError ? "error" : "selected");
    if (!validationError) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
    event.target.value = "";
  };

  const analyze = async () => {
    if (!file || state === "analyzing") return;
    setState("analyzing");
    setError("");
    const body = new FormData();
    body.append("photo", file);
    try {
      const data = await apiRequest("/ai/student/meal-photo-analysis", { method: "POST", body, timeoutMs: 30000 });
      setResult(data);
      setState("success");
    } catch (requestError) {
      setError(ERROR_MESSAGES[requestError.code] || requestError.message || "Não foi possível analisar a imagem.");
      setState("error");
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFile(null);
    setResult(null);
    setError("");
    setState("idle");
  };

  return <section className="meal-photo-analyzer" aria-labelledby="meal-photo-title">
    <header>
      <div className="meal-photo-icon"><Sparkles size={22} aria-hidden="true" /></div>
      <div><p className="eyebrow">Análise visual com IA</p><h2 id="meal-photo-title">O que tem no seu prato?</h2><p>Envie uma foto para receber uma estimativa visual dos alimentos e porções.</p></div>
    </header>

    <input ref={inputRef} className="meal-photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={chooseFile} />

    {!previewUrl && <button className="meal-photo-picker" type="button" onClick={() => inputRef.current?.click()}>
      <Camera size={24} aria-hidden="true" /><strong>Tirar foto ou selecionar imagem</strong><span>JPEG, PNG ou WebP, até 5 MB</span>
    </button>}

    {previewUrl && <div className="meal-photo-preview">
      <img src={previewUrl} alt="Prévia da refeição selecionada" />
      <div className="meal-photo-actions">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={state === "analyzing"}><Upload size={18} />Trocar foto</button>
        <button className="primary" type="button" onClick={analyze} disabled={state === "analyzing"}>
          {state === "analyzing" ? <><LoaderCircle className="spin" size={18} />Analisando...</> : <><Sparkles size={18} />Analisar com IA</>}
        </button>
      </div>
    </div>}

    {error && <div className="meal-photo-error" role="alert"><strong>Não foi possível concluir a análise</strong><span>{error}</span></div>}

    {result && <div className="meal-photo-result" aria-live="polite">
      <header><div><p className="eyebrow">Resultado estimado</p><h3>Alimentos identificados</h3></div><span>{confidenceLabel(result.overall_confidence)}</span></header>
      {result.foods.length ? <div className="meal-photo-foods">{result.foods.map((food, index) => <article key={`${food.name}-${index}`}>
        <div><strong>{food.name}</strong><span>{formatFoodEstimate(food)}</span></div>
        <small>{confidenceLabel(food.confidence)}</small>
        {food.note && <p>{food.note}</p>}
      </article>)}</div> : <div className="meal-photo-empty"><strong>Nenhum alimento foi identificado com segurança.</strong><span>Tente outra foto com boa iluminação e o prato inteiro visível.</span></div>}
      {result.limitations?.length > 0 && <div className="meal-photo-limitations"><strong>Limitações desta análise</strong><ul>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      <p className="meal-photo-disclaimer">{result.disclaimer}</p>
      <button className="meal-photo-another" type="button" onClick={reset}><RefreshCw size={18} />Analisar outra foto</button>
    </div>}
  </section>;
}
