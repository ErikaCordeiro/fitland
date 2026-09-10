import React, { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileArchive,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  Image,
  MessageCircle,
  MoreHorizontal,
  Pill,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Video,
  X
} from "lucide-react";

const categories = [
  { id: "all", label: "Todos", icon: FolderOpen },
  { id: "exams", label: "Exames", icon: FileCheck2 },
  { id: "photos", label: "Fotos", icon: Image },
  { id: "vídeos", label: "Vídeos", icon: Video },
  { id: "assessments", label: "Avaliações", icon: FileText },
  { id: "diet", label: "Dieta", icon: Pill },
  { id: "training", label: "Treino", icon: FileArchive },
  { id: "other", label: "Outros", icon: MoreHorizontal }
];

const initialFiles = [
  {
    id: "file-1",
    name: "Exame de Sangue - Maio/2026.pdf",
    category: "Exames",
    categoryId: "exams",
    date: "24/05/2026",
    time: "10:15",
    size: "2.4 MB",
    status: "Visto pelo personal",
    statusType: "viewed",
    description: "Exame de sangue completo realizado em 24/05/2026.",
    preview: "document",
    comment: "Parabéns! Seus exames estão excelentes. Continue assim."
  },
  {
    id: "file-2",
    name: "Evolução Frontal - 24/05/2026.jpg",
    category: "Fotos",
    categoryId: "photos",
    date: "24/05/2026",
    time: "09:42",
    size: "1.8 MB",
    status: "Visto pelo personal",
    statusType: "viewed",
    description: "Foto frontal para acompanhamento visual da evolução.",
    preview: "photo",
    comment: "Ótimo ângulo para comparar sua próxima avaliação."
  },
  {
    id: "file-3",
    name: "Avaliação Física Completa.pdf",
    category: "Avaliações",
    categoryId: "assessments",
    date: "22/05/2026",
    time: "14:05",
    size: "3.1 MB",
    status: "Aprovado pelo personal",
    statusType: "approved",
    description: "Relatório completo da avaliação física do ciclo atual.",
    preview: "document",
    comment: "Aprovado. Vamos manter a estratégia por mais duas semanas."
  },
  {
    id: "file-4",
    name: "Execucao Agachamento.mp4",
    category: "Vídeos",
    categoryId: "vídeos",
    date: "21/05/2026",
    time: "09:15",
    size: "25.6 MB",
    status: "Solicita revisão",
    statusType: "review",
    description: "Vídeo enviado para análise técnica da execução.",
    preview: "video",
    comment: "Vamos ajustar a amplitude e o alinhamento dos joelhos."
  },
  {
    id: "file-5",
    name: "Receita Medica - Creatina.pdf",
    category: "Outros",
    categoryId: "other",
    date: "20/05/2026",
    time: "16:22",
    size: "1.2 MB",
    status: "Enviado",
    statusType: "sent",
    description: "Documento médico anexado ao histórico do aluno.",
    preview: "document",
    comment: "Ainda vou revisar esse arquivo."
  },
  {
    id: "file-6",
    name: "Dieta Atual - Plano Alimentar.pdf",
    category: "Dieta",
    categoryId: "diet",
    date: "18/05/2026",
    time: "11:05",
    size: "2.7 MB",
    status: "Visto pelo personal",
    statusType: "viewed",
    description: "Plano alimentar atual utilizado no acompanhamento.",
    preview: "document",
    comment: "Plano alinhado com a meta atual."
  }
];

const allowedTypes = ["Exames e laudos", "Fotos e vídeos", "PDFs e documentos", "Receitas médicas", "Avaliações e relatórios", "Outros arquivos"];

export default function StudentFiles({ student, branding }) {
  const personalName = branding?.display_name || "Seu personal";
  const personalImage = branding?.profile_image_url || branding?.logo_url || branding?.icon_url || "/fitland-icon.svg";
  const inputRef = useRef(null);
  const [files, setFiles] = useState(initialFiles);
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialFiles[0].id);
  const [dragActive, setDragActive] = useState(false);
  const [comment, setComment] = useState("");

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesCategory = activeCategory === "all" || file.categoryId === activeCategory;
      const term = query.trim().toLowerCase();
      const matchesQuery = !term || [file.name, file.category, file.date, file.status].some((value) => value.toLowerCase().includes(term));
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, files, query]);

  const selectedFile = files.find((file) => file.id === selectedId) || filteredFiles[0] || files[0];

  const addFiles = (fileList) => {
    const uploaded = Array.from(fileList || []);
    if (!uploaded.length) return;
    const mapped = uploaded.map((file) => {
      const category = categoryFromType(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        category: category.label,
        categoryId: category.id,
        date: "Hoje",
        time: "Agora",
        size: formatSize(file.size),
        status: "Enviado",
        statusType: "sent",
        description: "Arquivo enviado pelo aluno para acompanhamento do personal.",
        preview: category.id === "photos" ? "photo" : category.id === "vídeos" ? "vídeo" : "document",
        comment: "Arquivo recebido. O personal será notificado para analisar."
      };
    });
    setFiles((current) => [...mapped, ...current]);
    setSelectedId(mapped[0].id);
  };

  const removeSelected = () => {
    if (!selectedFile) return;
    setFiles((current) => current.filter((file) => file.id !== selectedFile.id));
    setSelectedId(files.find((file) => file.id !== selectedFile.id)?.id || null);
  };

  return (
    <section className="student-files-page">
      <header className="student-files-header">
        <div>
          <h2>Arquivos</h2>
          <p>Envie e organize seus arquivos. Seu personal tem acesso para acompanhar sua evolução.</p>
        </div>
        <div className="student-files-safe-card">
          <ShieldCheck size={27} />
          <span><strong>Seus arquivos são seguros</strong><small>Compartilhados apenas com seu personal.</small></span>
        </div>
      </header>

      <div className="student-files-shell">
        <main className="student-files-main">
          <article
            className={`student-upload-card ${dragActive ? "dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <div className="student-upload-drop">
              <div className="student-upload-orb"><UploadCloud size={46} /></div>
              <div>
                <span>Enviar arquivo</span>
                <h3>Arraste e solte seus arquivos aqui</h3>
                <p>ou clique para selecionar.</p>
                <button type="button" onClick={() => inputRef.current?.click()}>Selecionar arquivo</button>
                <input ref={inputRef} type="file" multiple hidden onChange={(event) => addFiles(event.target.files)} />
              </div>
            </div>
            <div className="student-upload-types">
              <strong>Você pode enviar:</strong>
              {allowedTypes.map((type) => <span key={type}><FileText size={16} /> {type}</span>)}
            </div>
          </article>

          <nav className="student-file-categories" aria-label="Categorias de arquivos">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button key={category.id} className={activeCategory === category.id ? "active" : ""} type="button" onClick={() => setActiveCategory(category.id)}>
                  <Icon size={18} /> {category.label}
                </button>
              );
            })}
          </nav>

          <article className="student-files-list-card">
            <div className="student-files-list-title">
              <h3>Arquivos recentes</h3>
              <div>
                <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar arquivo" /></label>
                <button type="button"><Filter size={18} /> Filtros</button>
              </div>
            </div>

            <div className="student-files-list">
              {filteredFiles.map((file) => (
                <button key={file.id} type="button" className={`student-file-row ${selectedFile?.id === file.id ? "selected" : ""}`} onClick={() => setSelectedId(file.id)}>
                  <FileIcon type={file.preview} />
                  <span className="student-file-name"><strong>{file.name}</strong><small>{file.category} | {file.date} | {file.size}</small></span>
                  <span className={`student-file-status ${file.statusType}`}><i /> {file.status}<small>{file.date} as {file.time}</small></span>
                  <span className="student-file-actions"><MessageCircle size={18} /><Download size={18} /><MoreHorizontal size={18} /></span>
                </button>
              ))}
            </div>

            <button className="student-files-more" type="button">Ver mais arquivos <ChevronDown size={18} /></button>
          </article>
        </main>

        {selectedFile && (
          <aside className="student-file-detail-panel">
            <button className="student-file-close" type="button" aria-label="Fechar detalhes" onClick={() => setSelectedId(null)}><X size={18} /></button>
            <div className="student-file-detail-head">
              <FileIcon type={selectedFile.preview} />
              <div><strong>{selectedFile.name}</strong><small>Enviado em {selectedFile.date} as {selectedFile.time}</small></div>
            </div>
            <FilePreview type={selectedFile.preview} name={selectedFile.name} />
            <div className="student-file-detail-meta">
              <span><strong>Tamanho</strong>{selectedFile.size}</span>
              <span><strong>Status</strong><em className={selectedFile.statusType}>{selectedFile.status}</em></span>
              <span><strong>Categoria</strong>{selectedFile.category}</span>
              <span><strong>Descricao</strong>{selectedFile.description}</span>
            </div>
            <div className="student-file-detail-actions">
              <button type="button"><Download size={17} /> Baixar</button>
              <button type="button"><Share2 size={17} /> Compartilhar</button>
              <button type="button" onClick={removeSelected}><Trash2 size={17} /> Excluir</button>
            </div>

            <article className="student-file-comments">
              <div><h3>Comentários do personal</h3><button type="button">Ver todos</button></div>
              <div className="student-file-comment">
                <img src={personalImage} alt={personalName} />
                <span><strong>{personalName} <CheckCircle2 size={15} /></strong><small>24/05/2026 as 14:32</small><p>{selectedFile.comment}</p></span>
              </div>
              <label>
                <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Adicionar comentário..." />
                <button type="button" onClick={() => setComment("")}><Send size={17} /></button>
              </label>
            </article>
          </aside>
        )}
      </div>
    </section>
  );
}

function FileIcon({ type }) {
  if (type === "photo") return <span className="student-file-icon photo"><Image size={22} /></span>;
  if (type === "video") return <span className="student-file-icon video"><Video size={22} /></span>;
  return <span className="student-file-icon document"><FileText size={22} /></span>;
}

function FilePreview({ type, name }) {
  if (type === "photo") {
    return <div className="student-file-preview photo"><img src="/erika-gomes.jpeg" alt={name} /></div>;
  }
  if (type === "video") {
    return <div className="student-file-preview video"><Video size={42} /><strong>Prévia do vídeo</strong><small>{name}</small></div>;
  }
  return (
    <div className="student-file-preview document">
      <FileText size={46} />
      <strong>Pré-visualização segura</strong>
      <small>{name}</small>
    </div>
  );
}

function categoryFromType(file) {
  if (file.type?.startsWith("image/")) return { id: "photos", label: "Fotos" };
  if (file.type?.startsWith("video/")) return { id: "vídeos", label: "Vídeos" };
  if (file.name?.toLowerCase().includes("dieta")) return { id: "diet", label: "Dieta" };
  if (file.name?.toLowerCase().includes("treino")) return { id: "training", label: "Treino" };
  if (file.name?.toLowerCase().includes("avaliação")) return { id: "assessments", label: "Avaliações" };
  if (file.name?.toLowerCase().includes("exame")) return { id: "exams", label: "Exames" };
  return { id: "other", label: "Outros" };
}

function formatSize(size) {
  if (!size) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}
