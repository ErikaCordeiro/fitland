import React, { useMemo, useState } from "react";
import {
  AlertTriangle, Brain, CalendarDays, ChevronRight, CircleDollarSign,
  Download, MessageCircle, RefreshCw, Send, ShieldCheck, TrendingUp,
  Users, Wallet, X
} from "lucide-react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function normalizeStudent(student) {
  const monthlyFee = Number(student.monthlyFee ?? student.monthly_fee ?? 199);
  const paymentStatus = student.paymentStatus || student.payment_status || "Em dia";
  const dueDay = Number(student.paymentDueDay ?? student.payment_due_day ?? 10);
  const status = paymentStatus.toLocaleLowerCase("pt-BR");
  return {
    ...student,
    monthlyFee: Number.isFinite(monthlyFee) ? monthlyFee : 0,
    paymentStatus,
    dueDay: Math.min(28, Math.max(1, dueDay || 10)),
    overdue: status.includes("atras") || status.includes("inadimpl"),
    plan: student.plan || student.planName || "Plano Premium"
  };
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function PersonalFinance({ students = [], branding }) {
  const fallbackAvatar = branding?.icon_url || branding?.logo_url || "/fitland-icon.svg";
  const [modal, setModal] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const financialStudents = useMemo(() => students
    .filter((student) => student && student.accessApproved !== false && student.status !== "deleted")
    .map(normalizeStudent), [students]);

  const overdueStudents = financialStudents.filter((student) => student.overdue);
  const payingStudents = financialStudents.filter((student) => !student.overdue);
  const monthlyRevenue = payingStudents.reduce((total, student) => total + student.monthlyFee, 0);
  const pendingRevenue = overdueStudents.reduce((total, student) => total + student.monthlyFee, 0);
  const totalExpected = monthlyRevenue + pendingRevenue;
  const renewalRate = financialStudents.length
    ? Math.round((payingStudents.length / financialStudents.length) * 100) : 0;
  const healthScore = financialStudents.length
    ? Math.max(0, 100 - Math.round((overdueStudents.length / financialStudents.length) * 100)) : 0;
  const periodText = new Intl.DateTimeFormat("pt-BR", { month: "2-digit", year: "numeric" }).format(new Date());

  const kpis = [
    { label: "Receita do m\u00eas", value: money.format(monthlyRevenue), detail: "Pagamentos em dia", icon: CircleDollarSign },
    { label: "Alunos pagantes", value: String(payingStudents.length), detail: `${financialStudents.length} aluno(s) ativo(s)`, icon: Users },
    { label: "Inadimplentes", value: String(overdueStudents.length), detail: money.format(pendingRevenue), icon: AlertTriangle, danger: overdueStudents.length > 0 },
    { label: "Taxa de pagamento", value: `${renewalRate}%`, detail: "No per\u00edodo atual", icon: RefreshCw }
  ];

  const closeModal = () => { setModal(null); setSelectedStudent(null); };
  const openStudent = (student, type = "student") => { setSelectedStudent(student); setModal(type); };

  const exportReport = () => {
    const rows = financialStudents.map((student) => [
      student.name, student.email, student.plan,
      student.monthlyFee.toFixed(2).replace(".", ","),
      `Dia ${student.dueDay}`, student.paymentStatus
    ]);
    const csv = [["Aluno", "E-mail", "Plano", "Mensalidade", "Vencimento", "Status"], ...rows]
      .map((row) => row.map(csvValue).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financeiro-${new Date().toISOString().slice(0, 7)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="finance-page">
      <div className="finance-header-card">
        <div><span className="eyebrow">Painel administrativo</span><h2>Financeiro</h2><p>Dados calculados a partir dos alunos cadastrados e seus pagamentos.</p></div>
        <div className="finance-toolbar">
          <button type="button" onClick={() => setModal("period")}><CalendarDays size={18} /> {periodText}</button>
          <button type="button" onClick={exportReport}><Download size={18} /> Exportar relat&oacute;rio</button>
        </div>
      </div>

      <div className="finance-kpi-grid">
        <article className="finance-health-card">
          <div className="finance-score-ring"><strong>{healthScore}</strong><span>/100</span></div>
          <div>
            <p className="eyebrow">Sa&uacute;de financeira</p>
            <h3>{financialStudents.length ? (overdueStudents.length ? "Requer aten\u00e7\u00e3o" : "Em dia") : "Sem dados"}</h3>
            <span>{financialStudents.length ? `${payingStudents.length} de ${financialStudents.length} pagamento(s) em dia.` : "Cadastre um aluno para iniciar o relat\u00f3rio."}</span>
            <button type="button" onClick={() => setModal("analysis")}><Brain size={15} /> Ver an&aacute;lise</button>
          </div>
        </article>
        {kpis.map(({ label, value, detail, icon: Icon, danger }) => (
          <button key={label} className="finance-kpi-card" type="button" onClick={() => setModal(label === "Inadimplentes" ? "charges" : "students")}>
            <div className="finance-kpi-top"><span className="finance-kpi-icon"><Icon size={22} /></span></div>
            <p>{label}</p><strong>{value}</strong><span className={danger ? "danger" : "positive"}>{detail}</span>
            <MiniLine values={danger ? [8, 7, 6, 5, 4] : [2, 3, 3, 4, Math.max(4, payingStudents.length + 3)]} danger={danger} />
          </button>
        ))}
      </div>

      <article className="finance-chart-card">
        <div className="section-heading"><div><span className="eyebrow">Receita registrada</span><h2>{monthLabel.format(new Date())}</h2></div><button type="button" onClick={() => setModal("transactions")}>Ver lan&ccedil;amentos</button></div>
        <div className="finance-real-summary">
          <div><span>Receita recebida</span><strong>{money.format(monthlyRevenue)}</strong><small>{payingStudents.length} pagamento(s)</small></div>
          <div><span>Receita pendente</span><strong>{money.format(pendingRevenue)}</strong><small>{overdueStudents.length} cobran&ccedil;a(s)</small></div>
          <div><span>Receita prevista</span><strong>{money.format(totalExpected)}</strong><small>{financialStudents.length} aluno(s) ativo(s)</small></div>
        </div>
      </article>

      <div className="finance-two-columns">
        <article className="finance-card">
          <div className="section-heading"><h2>Cobran&ccedil;as pendentes</h2><button type="button" onClick={() => setModal("charges")}>Ver todas</button></div>
          <div className="finance-charge-list">
            {overdueStudents.length ? overdueStudents.map((student) => (
              <div key={student.id || student.email} className="finance-charge-row">
                <img src={student.avatar || fallbackAvatar} alt={student.name} />
                <div><strong>{student.name}</strong><span>{student.plan}</span></div>
                <div className="finance-charge-value"><strong>{money.format(student.monthlyFee)}</strong><small>{student.paymentStatus}</small></div>
                <button type="button" aria-label={`Cobrar ${student.name}`} onClick={() => openStudent(student, "charge")}><MessageCircle size={18} /></button>
              </div>
            )) : <EmptyFinance text="Nenhuma cobran\u00e7a pendente." />}
          </div>
          <button className="finance-wide-button" type="button" disabled={!overdueStudents.length} onClick={() => setModal("chargeAll")}><Send size={18} /> Cobrar inadimplentes</button>
        </article>

        <article className="finance-card">
          <div className="section-heading"><h2>Pr&oacute;ximos vencimentos</h2><button type="button" onClick={() => setModal("due")}>Ver todos</button></div>
          <div className="finance-due-list">
            {financialStudents.length ? financialStudents.map((student) => (
              <button type="button" key={student.id || student.email} onClick={() => openStudent(student)}>
                <span>{student.name}</span><small>{student.plan} &middot; dia {student.dueDay}</small><strong>{money.format(student.monthlyFee)}</strong><ChevronRight size={16} />
              </button>
            )) : <EmptyFinance text="Nenhum vencimento cadastrado." />}
          </div>
        </article>
      </div>

      <article className="finance-ai-card">
        <div className="finance-ai-orb"><Brain size={44} /></div>
        <div className="finance-ai-insights"><h2>An&aacute;lise financeira</h2><p><TrendingUp size={16} /> Receita atual: {money.format(monthlyRevenue)}.</p><p><AlertTriangle size={16} /> {overdueStudents.length} aluno(s) inadimplente(s).</p><p><ShieldCheck size={16} /> Taxa de pagamentos em dia: {renewalRate}%.</p><p><Wallet size={16} /> Receita prevista: {money.format(totalExpected)}.</p></div>
        <button type="button" onClick={() => setModal("analysis")}><Brain size={18} /> Ver an&aacute;lise completa</button>
      </article>

      <article className="finance-flow-card">
        <div className="section-heading"><h2>Fluxo financeiro</h2><button type="button" onClick={() => setModal("transactions")}>Este m&ecirc;s</button></div>
        <div className="finance-flow-grid">
          {[
            { label: "Receitas", value: monthlyRevenue, type: "positive" },
            { label: "Pend\u00eancias", value: pendingRevenue, type: "warning" },
            { label: "Saldo registrado", value: monthlyRevenue, type: "neutral" }
          ].map((item) => <div key={item.label} className={`finance-flow-item ${item.type}`}><span>{item.label}</span><strong>{money.format(item.value)}</strong><small>Per&iacute;odo atual</small><MiniLine values={[1, 1, 2, 2, Math.max(2, item.value)]} danger={item.type === "warning"} /></div>)}
          <div className="finance-margin"><div><strong>{renewalRate}%</strong><span>pagamentos em dia</span></div></div>
        </div>
      </article>

      {modal && <div className="finance-modal-backdrop" role="presentation" onClick={closeModal}>
        <div className="finance-modal finance-data-modal" role="dialog" aria-modal="true" aria-label="Detalhes financeiros" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="finance-modal-close" aria-label="Fechar" onClick={closeModal}><X size={18} /></button>
          <span className="eyebrow">Relat&oacute;rio financeiro</span>
          <FinanceModalContent modal={modal} selectedStudent={selectedStudent} students={financialStudents} overdueStudents={overdueStudents} monthlyRevenue={monthlyRevenue} pendingRevenue={pendingRevenue} />
          <button type="button" className="finance-wide-button" onClick={closeModal}>Fechar</button>
        </div>
      </div>}
    </section>
  );
}

function FinanceModalContent({ modal, selectedStudent, students, overdueStudents, monthlyRevenue, pendingRevenue }) {
  if (modal === "analysis") return <><h3>Resumo do per&iacute;odo</h3><p>{students.length} aluno(s) ativo(s), receita recebida de {money.format(monthlyRevenue)} e {money.format(pendingRevenue)} pendente(s).</p></>;
  if (modal === "period") return <><h3>Per&iacute;odo atual</h3><p>Os dados exibidos correspondem ao m&ecirc;s corrente e s&atilde;o recalculados conforme os alunos e pagamentos cadastrados.</p></>;
  if (modal === "chargeAll") return <><h3>Cobran&ccedil;a em lote</h3><p>{overdueStudents.length ? `${overdueStudents.length} cobran\u00e7a(s) pronta(s) para contato.` : "N\u00e3o h\u00e1 alunos inadimplentes para cobrar."}</p></>;
  if (selectedStudent) return <><h3>{selectedStudent.name}</h3><div className="finance-modal-rows"><span><small>Plano</small><strong>{selectedStudent.plan}</strong></span><span><small>Mensalidade</small><strong>{money.format(selectedStudent.monthlyFee)}</strong></span><span><small>Vencimento</small><strong>Dia {selectedStudent.dueDay}</strong></span><span><small>Status</small><strong>{selectedStudent.paymentStatus}</strong></span></div></>;
  const list = modal === "charges" ? overdueStudents : students;
  const title = modal === "charges" ? "Cobran\u00e7as pendentes" : modal === "due" ? "Pr\u00f3ximos vencimentos" : modal === "transactions" ? "Lan\u00e7amentos do m\u00eas" : "Alunos pagantes";
  return <><h3>{title}</h3><div className="finance-modal-list">{list.length ? list.map((student) => <div key={student.id || student.email}><img src={student.avatar || fallbackAvatar} alt="" /><span><strong>{student.name}</strong><small>{student.plan} &middot; vencimento dia {student.dueDay}</small></span><strong>{money.format(student.monthlyFee)}</strong><em>{student.paymentStatus}</em></div>) : <EmptyFinance text="Nenhum registro encontrado." />}</div></>;
}

function EmptyFinance({ text }) {
  return <div className="finance-empty-state"><ShieldCheck size={22} /><span>{text}</span></div>;
}

function MiniLine({ values, danger = false }) {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${42 - (value / max) * 34}`).join(" ");
  return <svg className={`finance-mini-line ${danger ? "danger" : ""}`} viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}
