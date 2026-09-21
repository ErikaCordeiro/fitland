import React from "react";
import { Plus, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StudentCard from "../components/StudentCard.jsx";

export default function Students({
  students,
  dataStatus = "success",
  dataError = "",
  onRetry,
  pendingStudents = [],
  workouts,
  onSaveStudent,
  onApproveStudent,
  onDeleteStudent,
  onOpenProgress,
  focusedPendingStudentId,
  onPendingStudentViewed
}) {
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [pendingDetail, setPendingDetail] = useState(null);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const filtered = useMemo(
    () => students.filter((student) => `${student.name} ${student.objective}`.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  );

  useEffect(() => {
    if (!focusedPendingStudentId) return;
    const student = pendingStudents.find((item) => item.id === focusedPendingStudentId);
    if (student) {
      setPendingDetail(student);
      setApprovalChecked(false);
      onPendingStudentViewed?.();
    }
  }, [focusedPendingStudentId, pendingStudents, onPendingStudentViewed]);

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
        age: Number(form.get("age")),
        weight: Number(form.get("weight")),
        height: Number(form.get("height")),
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

  return (
    <>
      <section className="content-section">
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
      </section>

      {pendingStudents.length > 0 && (
        <section className="content-section pending-students-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Aprovacao de acesso</p>
              <h2>Cadastros Aguardando aprovacao</h2>
              <span>Revise os dados enviados pelo aluno e aprove para liberar o uso do app.</span>
            </div>
          </div>
          <div className="pending-student-grid">
            {pendingStudents.map((student) => (
              <article key={student.id} className="pending-student-card">
                <div>
                  <strong>{student.name}</strong>
                  <span>{student.email}</span>
                </div>
                <dl>
                  <div><dt>Idade</dt><dd>{student.age} anos</dd></div>
                  <div><dt>Peso</dt><dd>{student.weight} kg</dd></div>
                  <div><dt>Altura</dt><dd>{student.height} m</dd></div>
                  <div><dt>Objetivo</dt><dd>{student.objective}</dd></div>
                </dl>
                {student.notes ? <p>{student.notes}</p> : null}
                <div className="pending-card-actions">
                  <button className="ghost-button inline" type="button" onClick={() => { setPendingDetail(student); setApprovalChecked(false); }}>
                    Ver dados
                  </button>
                  <button className="metal-button inline" type="button" onClick={() => onApproveStudent?.(student)}>
                    Aprovar e liberar app
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {pendingDetail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Dados do aluno pendente">
          <form
            className="student-modal pending-approval-modal"
            onSubmit={(event) => {
              event.preventDefault();
              if (!approvalChecked) return;
              onApproveStudent?.(pendingDetail);
              setPendingDetail(null);
              setApprovalChecked(false);
            }}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Novo cadastro</p>
                <h2>Revisar aluno</h2>
                <span>Confira os dados enviados antes de liberar acesso ao app.</span>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar" onClick={() => setPendingDetail(null)}>
                <X size={19} />
              </button>
            </div>

            <div className="pending-review-grid">
              <div><span>Nome</span><strong>{pendingDetail.name}</strong></div>
              <div><span>Email</span><strong>{pendingDetail.email}</strong></div>
              <div><span>Idade</span><strong>{pendingDetail.age} anos</strong></div>
              <div><span>Peso</span><strong>{pendingDetail.weight} kg</strong></div>
              <div><span>Altura</span><strong>{pendingDetail.height} m</strong></div>
              <div><span>Objetivo</span><strong>{pendingDetail.objective}</strong></div>
              <div className="wide"><span>Observações</span><p>{pendingDetail.notes || "Sem observações informadas."}</p></div>
            </div>

            <label className="wide access-toggle-card approval-check-card">
              <input
                type="checkbox"
                checked={approvalChecked}
                onChange={(event) => setApprovalChecked(event.target.checked)}
              />
              <span>
                <strong>Conferi os dados e quero liberar o app para este aluno</strong>
                <small>Ao confirmar, o aluno entra na lista ativa e o acesso fica liberado.</small>
              </span>
            </label>

            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setPendingDetail(null)}>Cancelar</button>
              <button className="metal-button inline" type="submit" disabled={!approvalChecked}>
                <Save size={18} /> Aceitar aluno
              </button>
            </div>
          </form>
        </div>
      )}

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
              <label><span>Idade</span><input name="age" type="number" min="12" max="100" required defaultValue={editingStudent?.age || ""} /></label>
              <label><span>Peso</span><input name="weight" type="number" min="30" step="0.1" required defaultValue={editingStudent?.weight || ""} /></label>
              <label><span>Altura</span><input name="height" type="number" min="1" max="2.5" step="0.01" required defaultValue={editingStudent?.height || ""} /></label>
              <label><span>Objetivo</span><input name="objective" required placeholder="Hipertrofia, definição, performance..." defaultValue={editingStudent?.objective || ""} /></label>
              <div className="wide access-toggle-card">
                <span>
                  <strong>Acesso ao app do aluno</strong>
                  <small>Este cadastro cria o perfil do aluno. A criação de login e o envio de convite ainda não estão disponíveis.</small>
                </span>
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
