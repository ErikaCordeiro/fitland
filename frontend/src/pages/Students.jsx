import React from "react";
import { Plus, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StudentCard from "../components/StudentCard.jsx";
import { apiRequest } from "../services/api.js";
import { optionalFormNumber } from "../utils/studentPresentation.js";

export default function Students({
  students,
  dataStatus = "success",
  dataError = "",
  onRetry,
  workouts,
  onSaveStudent,
  onSendAccess,
  onRequestApproved,
  onDeleteStudent,
  onOpenProgress
}) {
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [view, setView] = useState("students");
  const [requests, setRequests] = useState([]);
  const [requestsStatus, setRequestsStatus] = useState("loading");
  const [requestsError, setRequestsError] = useState("");
  const [reviewingId, setReviewingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const filtered = useMemo(
    () => students.filter((student) => `${student.name} ${student.objective ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  );

  const loadRequests = () => {
    setRequestsStatus("loading");
    setRequestsError("");
    return apiRequest("/student-access-requests")
      .then((items) => { setRequests(items); setRequestsStatus("success"); })
      .catch((requestError) => { setRequestsError(requestError.message); setRequestsStatus("error"); });
  };

  useEffect(() => { loadRequests(); }, []);

  const reviewRequest = async (request, action) => {
    if (reviewingId) return;
    setReviewingId(request.id);
    setRequestsError("");
    try {
      await apiRequest(`/student-access-requests/${request.id}/${action}`, {
        method: "POST",
        body: action === "reject" ? JSON.stringify({ reason: null }) : undefined,
      });
      setRequests((current) => current.filter((item) => item.id !== request.id));
      if (action === "approve") onRequestApproved?.();
    } catch (requestError) {
      setRequestsError(requestError.message || "Não foi possível analisar a solicitação.");
    } finally {
      setReviewingId(null);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setSaveError("");
    try {
      await onSaveStudent({
        id: editingStudent?.id,
        name: form.get("name"),
        email: form.get("email"),
        age: optionalFormNumber(form.get("age")),
        weight: optionalFormNumber(form.get("weight")),
        height: optionalFormNumber(form.get("height")),
        objective: form.get("objective"),
        notes: form.get("notes"),
      });
      setIsModalOpen(false);
      setEditingStudent(null);
      event.currentTarget.reset();
    } catch (error) {
      setSaveError(error?.message || "Não foi possível salvar o aluno.");
    } finally {
      setSaving(false);
    }
  };

  const openNewStudent = () => {
    setEditingStudent(null);
    setSaveError("");
    setIsModalOpen(true);
  };

  const openEditStudent = (student) => {
    setEditingStudent(student);
    setSaveError("");
    setIsModalOpen(true);
  };

  const sendAccess = async () => {
    if (!editingStudent || accessBusy) return;
    setAccessBusy(true); setSaveError("");
    try { await onSendAccess(editingStudent); setEditingStudent({ ...editingStudent, access_status: "pending" }); }
    catch (error) { setSaveError(error?.message || "Não foi possível enviar o convite."); }
    finally { setAccessBusy(false); }
  };

  return (
    <>
      <section className="content-section">
        <div className="student-list-tabs" role="tablist" aria-label="Alunos e solicitações">
          <button type="button" role="tab" aria-selected={view === "students"} className={view === "students" ? "active" : ""} onClick={() => setView("students")}>Todos</button>
          <button type="button" role="tab" aria-selected={view === "requests"} className={view === "requests" ? "active" : ""} onClick={() => setView("requests")}>Solicitações <span>{requests.length}</span></button>
        </div>
        {view === "students" && <>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Gestão de alunos</p>
            <h2>Lista de alunos</h2>
          </div>
          <div className="section-actions">
            <label className="search-shell compact-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno" />
            </label>
            <button className="metal-button inline" type="button" onClick={openNewStudent}>
              <Plus size={18} /> Adicionar aluno
            </button>
          </div>
        </div>
        {dataStatus === "loading" ? (
          <div className="tenant-data-state" role="status"><strong>Carregando alunos...</strong><span>Aguarde enquanto buscamos os dados deste Personal.</span></div>
        ) : dataStatus === "error" ? (
          <div className="tenant-data-state error" role="alert"><strong>Nao foi possivel carregar os alunos</strong><span>{dataError || "Tente novamente."}</span><button className="ghost-button inline" type="button" onClick={onRetry}>Tentar novamente</button></div>
        ) : filtered.length === 0 ? (
          <div className="tenant-data-state"><strong>{query ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}</strong><span>{query ? "Revise o termo pesquisado." : "Quando voce adicionar seu primeiro aluno, ele aparecera aqui."}</span>{!query ? <button className="metal-button inline" type="button" onClick={openNewStudent}><Plus size={18} /> Adicionar aluno</button> : null}</div>
        ) : <div className="students-grid">
          {filtered.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              onOpen={() => openEditStudent(student)}
              onOpenProgress={onOpenProgress}
              onDelete={onDeleteStudent}
            />
          ))}
        </div>}
        </>}
        {view === "requests" && <section className="pending-students-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Aprovacao de acesso</p>
              <h2>Solicitações de acesso</h2>
              <span>A aprovação gera o convite seguro para o aluno criar a própria senha.</span>
            </div>
          </div>
          {requestsError && <div className="tenant-data-state error" role="alert"><strong>Não foi possível carregar as solicitações</strong><span>{requestsError}</span><button type="button" className="ghost-button inline" onClick={loadRequests}>Tentar novamente</button></div>}
          {requestsStatus === "loading" ? <div className="tenant-data-state" role="status">Carregando solicitações...</div> : requests.length === 0 ? <div className="tenant-data-state"><strong>Nenhuma solicitação pendente</strong><span>Novos pedidos de acesso aparecerão aqui.</span></div> : <div className="pending-student-grid">
            {requests.map((request) => (
              <article key={request.id} className="pending-student-card">
                <div>
                  <strong>{request.first_name} {request.last_name}</strong>
                  <span>{request.email}</span>
                </div>
                <dl>
                  <div><dt>Solicitada em</dt><dd>{new Date(request.created_at).toLocaleDateString("pt-BR")}</dd></div>
                  <div><dt>Status</dt><dd>Pendente</dd></div>
                </dl>
                <div className="pending-card-actions">
                  <button className="ghost-button inline" type="button" disabled={Boolean(reviewingId)} onClick={() => reviewRequest(request, "reject")}>Recusar</button>
                  <button className="metal-button inline" type="button" disabled={Boolean(reviewingId)} onClick={() => reviewRequest(request, "approve")}>{reviewingId === request.id ? "Processando..." : "Aprovar e enviar convite"}</button>
                </div>
              </article>
            ))}
          </div>}
        </section>
        }
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingStudent ? "Editar aluno" : "Adicionar aluno"}>
          <form className="student-modal" onSubmit={submit}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{editingStudent ? "Editar aluno" : "Novo aluno"}</p>
                <h2>{editingStudent ? "Editar aluno" : "Adicionar aluno"}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar" onClick={() => { setIsModalOpen(false); setEditingStudent(null); }}>
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label><span>Nome</span><input name="name" required placeholder="Nome completo" defaultValue={editingStudent?.name || ""} /></label>
              <label><span>Email</span><input name="email" type="email" required placeholder="aluno@email.com" defaultValue={editingStudent?.email || ""} /></label>
              <label><span>Idade</span><input name="age" type="number" min="12" max="100" required defaultValue={editingStudent?.age ?? ""} /></label>
              <label><span>Peso</span><input name="weight" type="number" min="30" step="0.1" required defaultValue={editingStudent?.weight ?? ""} /></label>
              <label><span>Altura</span><input name="height" type="number" min="1" max="2.5" step="0.01" required defaultValue={editingStudent?.height ?? ""} /></label>
              <label><span>Objetivo</span><input name="objective" required placeholder="Hipertrofia, definição, performance..." defaultValue={editingStudent?.objective ?? ""} /></label>
              <div className="wide access-toggle-card student-access-panel">
                <span>
                  <strong>Acesso à plataforma</strong>
                  <small>E-mail: {editingStudent?.email || "Salve o aluno antes de enviar o acesso."}</small>
                  <small>Status: {{ no_access: "Não enviado", pending: "Convite enviado", expired: "Convite expirado", active: "Ativo" }[editingStudent?.access_status] || "Não enviado"}</small>
                </span>
                {editingStudent && editingStudent.access_status !== "active" && <button className="ghost-button inline" type="button" disabled={accessBusy || saving} onClick={sendAccess}>{accessBusy ? "Enviando..." : editingStudent.access_status === "pending" ? "Reenviar convite" : "Enviar acesso"}</button>}
              </div>
              <label className="wide">
                <span>Observações</span>
                <textarea name="notes" rows="4" placeholder="Lesões, limitações, rotina, preferências e estratégia." defaultValue={editingStudent?.notes || ""} />
              </label>
            </div>
            <div className="modal-actions">
              {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
              <button className="ghost-button" type="button" disabled={saving} onClick={() => { setIsModalOpen(false); setEditingStudent(null); }}>Cancelar</button>
              <button className="metal-button inline" type="submit" disabled={saving}><Save size={18} /> {saving ? "Salvando..." : editingStudent ? "Salvar edicao" : "Salvar aluno"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
