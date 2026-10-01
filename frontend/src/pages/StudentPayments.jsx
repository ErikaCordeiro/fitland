import React, { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { apiRequest } from "../services/api.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateBr = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const labels = { pending: "Pendente", partial: "Parcial", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado" };
export default function StudentPayments() {
  const [charges, setCharges] = useState([]), [state, setState] = useState("loading"), [error, setError] = useState("");
  const load = async () => { setState("loading"); try { setCharges(await apiRequest("/finance/charges")); setState("success"); } catch (e) { setError(e.detail || e.message || "Não foi possível carregar seus pagamentos."); setState("error"); } };
  useEffect(() => { load(); }, []);
  if (state === "loading") return <section className="student-finance-page"><div className="tenant-data-state">Carregando pagamentos...</div></section>;
  if (state === "error") return <section className="student-finance-page"><div className="tenant-data-state"><strong>Falha ao carregar</strong><span>{error}</span><button type="button" onClick={load}>Tentar novamente</button></div></section>;
  if (!charges.length) return <section className="student-finance-page"><div className="tenant-data-state"><Receipt size={28} /><strong>Nenhuma cobrança registrada.</strong><span>Suas informações financeiras aparecerão aqui.</span></div></section>;
  return <section className="student-finance-page"><header><p className="eyebrow">Meus Pagamentos</p><h2>Cobranças e histórico</h2><span>Visualização dos registros informados pelo seu Personal.</span></header><div className="student-finance-list">{charges.map((charge) => <article key={charge.id}><header><div><strong>{charge.description}</strong><span>Vencimento {dateBr(charge.due_date)}</span></div><mark data-status={charge.status}>{labels[charge.status]}</mark></header><dl><div><dt>Valor</dt><dd>{brl.format(charge.amount)}</dd></div><div><dt>Pago</dt><dd>{brl.format(charge.paid_amount)}</dd></div><div><dt>Saldo</dt><dd>{brl.format(charge.balance)}</dd></div></dl>{charge.payments.length > 0 && <div><h3>Pagamentos registrados</h3><ul>{charge.payments.map((payment) => <li key={payment.id}><span>{dateBr(payment.paid_at)}</span><strong>{brl.format(payment.amount)}</strong></li>)}</ul></div>}</article>)}</div></section>;
}
