import React, { useEffect, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { apiDownload, apiRequest } from "../services/api.js";

const categoryLabels = { document: "Documento", assessment: "Avaliação", workout: "Treino", nutrition: "Nutrição", other: "Outro" };
const formatSize = (value) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`;
function saveBlob(blob, filename) { const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = filename; anchor.click(); URL.revokeObjectURL(href); }

export default function StudentFiles() {
  const [files, setFiles] = useState([]); const [status, setStatus] = useState("loading"); const [message, setMessage] = useState(""); const [downloading, setDownloading] = useState(null);
  useEffect(() => { let active = true; apiRequest("/files").then((data) => { if (active) { setFiles(data || []); setStatus("ready"); } }).catch((error) => { if (active) { setMessage(error.message); setStatus("error"); } }); return () => { active = false; }; }, []);
  const download = async (file) => { setDownloading(file.id); setMessage(""); try { const result = await apiDownload(`/files/${file.id}/download`); saveBlob(result.blob, result.filename || file.original_filename); } catch (error) { setMessage(error.message); } finally { setDownloading(null); } };
  if (status === "loading") return <section className="private-files-state"><LoaderCircle className="spin" /> Carregando arquivos...</section>;
  return <section className="private-files-page">
    <header className="private-files-heading"><div><p className="eyebrow">Compartilhados com você</p><h2>Arquivos</h2><p>Documentos enviados pelo seu Personal.</p></div></header>
    {message && <p className="private-files-message" role="alert">{message}</p>}
    {status === "error" ? null : files.length === 0 ? <div className="private-files-empty"><FileText size={28} /><strong>Nenhum arquivo disponível</strong><span>Quando seu Personal liberar um documento, ele aparecerá aqui.</span></div> : <div className="private-files-grid">{files.map((file) => <article className="private-file-card" key={file.id}><div className="private-file-icon"><FileText /></div><div className="private-file-copy"><strong>{file.title || file.original_filename}</strong><span>{categoryLabels[file.category] || "Arquivo"} · {formatSize(file.size_bytes)}</span>{file.description && <p>{file.description}</p>}</div><button className="icon-action" type="button" title="Baixar arquivo" aria-label={`Baixar ${file.title || file.original_filename}`} disabled={downloading === file.id} onClick={() => download(file)}><Download size={20} /></button></article>)}</div>}
  </section>;
}
