import React, { useMemo, useState } from "react";
import {
  BadgeCheck,
  Barcode,
  ChevronRight,
  Crown,
  CreditCard,
  Download,
  Headphones,
  Mail,
  MessageCircle,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
  X
} from "lucide-react";

const paymentHistory = [
  { date: "10/06/2025", plan: "Plano Premium - Mensal", value: "R$ 199,00", status: "Pago" },
  { date: "10/05/2025", plan: "Plano Premium - Mensal", value: "R$ 199,00", status: "Pago" },
  { date: "10/04/2025", plan: "Plano Premium - Mensal", value: "R$ 199,00", status: "Pago" },
  { date: "10/03/2025", plan: "Plano Premium - Mensal", value: "R$ 199,00", status: "Pago" }
];

const paymentMethods = [
  { id: "card", title: "Cartao de credito", detail: "Final 4242", icon: CreditCard, status: "Padrao" },
  { id: "pix", title: "PIX", detail: "Chave aleatoria cadastrada", icon: QrCode, status: "Disponivel" },
  { id: "boleto", title: "Boleto bancario", detail: "Disponivel", icon: Barcode, status: "Alternativo" }
];

const planBenefits = [
  "Treinos ilimitados",
  "Dieta personalizada",
  "Avaliações físicas",
  "Coach IA",
  "Suporte premium"
];

export default function StudentPayments({ student, branding }) {
  const personalName = branding?.display_name || "Seu personal";
  const personalImage = branding?.logo_url || branding?.icon_url || "/fitland-icon.svg";
  const [modal, setModal] = useState(null);
  const studentName = student?.name || "Erika Gomes";

  const modalContent = useMemo(() => {
    const content = {
      pay: {
        title: "Pagar mensalidade",
        text: "Sua próxima cobrança está em dia. Quando houver boleto, PIX ou cartão disponível, o link de pagamento aparece aqui.",
        action: "Entendi"
      },
      method: {
        title: "Metodo de pagamento",
        text: "Na V1, esta área já está preparada para integrar cartão, PIX, boleto, Mercado Pago, Stripe, Asaas ou PagSeguro.",
        action: "Fechar"
      },
      plan: {
        title: "Plano Premium",
        text: "Seu plano garante acesso completo a treinos, dieta, avaliações, progresso, Coach IA e acompanhamento do personal.",
        action: "Ver beneficios"
      },
      support: {
        title: "Suporte financeiro",
        text: "Envie uma mensagem para ajustar vencimento, atualizar metodo de pagamento ou tirar dúvidas sobre sua assinatura.",
        action: "Abrir suporte"
      },
      receipt: {
        title: "Comprovante",
        text: "O comprovante em PDF sera liberado quando a integracao financeira estiver conectada ao gateway escolhido.",
        action: "Ok"
      },
      history: {
        title: "Histórico completo",
        text: "Aqui ficara a lista completa de pagamentos, faturas, comprovantes e reenvio por e-mail.",
        action: "Fechar"
      }
    };
    return content[modal] || null;
  }, [modal]);

  return <section className="student-payments-page"><div className="tenant-data-state"><strong>Sem dados de pagamento</strong><span>As cobranças e o histórico aparecerão quando houver integração financeira real.</span></div></section>;

  return (
    <section className="student-payments-page">
      <div className="payments-hero-header">
        <div>
          <span className="eyebrow">Assinatura premium</span>
          <h2>Pagamentos</h2>
          <p>Acompanhe suas cobranças, faturas e histórico.</p>
        </div>
        <button type="button" onClick={() => setModal("support")}>
          <Headphones size={18} />
          Suporte
        </button>
      </div>

      <article className="payment-main-card">
        <div className="payment-main-grid">
          <div className="payment-charge">
            <span>Próxima cobrança</span>
            <strong>R$ 199,00</strong>
            <div className="payment-plan-pill">
              <Crown size={24} />
              <div>
                <b>Plano Premium</b>
                <small>Mensal</small>
              </div>
            </div>
          </div>

          <div className="payment-due">
            <span>Vencimento</span>
            <strong>10/07/2025</strong>
            <small>Em 14 dias</small>
            <mark>
              <BadgeCheck size={24} />
              Status <b>Em dia</b>
            </mark>
          </div>

          <div className="payment-lion">
            <img src={personalImage} alt={personalName} />
          </div>
        </div>

        <div className="payment-actions">
          <button type="button" className="metal-button" onClick={() => setModal("pay")}>
            <Wallet size={18} />
            Pagar agora
          </button>
          <button type="button" onClick={() => setModal("method")}>
            <CreditCard size={18} />
            Alterar metodo
          </button>
          <button type="button" onClick={() => setModal("plan")}>
            <Receipt size={18} />
            Ver plano
          </button>
        </div>
      </article>

      <div className="payments-grid">
        <article className="payments-card payment-methods-card">
          <div className="payments-card-title">
            <h3>Metodos de pagamento</h3>
            <button type="button" onClick={() => setModal("method")}>Gerenciar <ChevronRight size={16} /></button>
          </div>
          <div className="payment-method-list">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button key={method.id} type="button" onClick={() => setModal("method")}>
                  <span className="payment-brand"><Icon size={30} /></span>
                  <span>
                    <b>{method.title}</b>
                    <small>{method.detail}</small>
                  </span>
                  {method.id === "card" ? <BadgeCheck className="paid-icon" size={23} /> : <ChevronRight size={22} />}
                </button>
              );
            })}
          </div>
        </article>

        <article className="payments-card payment-plan-card">
          <div className="payments-card-title">
            <h3>Seu plano</h3>
            <span>Renova em 10/07/2025</span>
          </div>
          <div className="plan-price">
            <Crown size={26} />
            <div>
              <strong>Plano Premium</strong>
              <p>R$ 199,00 / mes</p>
            </div>
          </div>
          <ul>
            {planBenefits.map((benefit) => (
              <li key={benefit}><ShieldCheck size={16} /> {benefit}</li>
            ))}
          </ul>
        </article>
      </div>

      <article className="payments-card payment-history-card">
        <div className="payments-card-title">
          <h3>Histórico de pagamentos</h3>
          <button type="button" onClick={() => setModal("history")}>Ver todos</button>
        </div>
        <div className="payment-history-list">
          {paymentHistory.map((item) => (
            <div key={`${item.date}-${item.plan}`} className="payment-history-row">
              <BadgeCheck className="paid-icon" size={27} />
              <span>{item.date}</span>
              <strong>{item.plan}</strong>
              <div>
                <b>{item.value}</b>
                <small>{item.status}</small>
              </div>
              <button type="button" aria-label="Baixar comprovante" onClick={() => setModal("receipt")}>
                <Download size={20} />
              </button>
            </div>
          ))}
        </div>
      </article>

      <div className="payments-grid">
        <article className="payments-card payment-support-card">
          <ShieldCheck size={80} />
          <div>
            <h3>Treine com foco. Nos cuidamos do resto.</h3>
            <p>Seu plano garante acesso completo a treinos, dieta, avaliações e acompanhamento.</p>
            <div>
              <span><Sparkles size={16} /> Acesso ilimitado</span>
              <span><MessageCircle size={16} /> Acompanhamento personalizado</span>
              <span><Headphones size={16} /> Suporte premium</span>
            </div>
          </div>
        </article>

        <article className="payments-card payment-help-card">
          <div className="payments-card-title">
            <h3>Precisa de ajuda?</h3>
            <span>{studentName}</span>
          </div>
          <button type="button" onClick={() => setModal("support")}><MessageCircle size={18} /> WhatsApp</button>
          <button type="button" onClick={() => setModal("support")}><Mail size={18} /> Abrir chamado</button>
          <button type="button" onClick={() => setModal("support")}><Headphones size={18} /> Falar com suporte</button>
        </article>
      </div>

      {modalContent && (
        <div className="payment-modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div className="payment-modal" role="dialog" aria-modal="true" aria-label={modalContent.title} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="payment-modal-close" aria-label="Fechar" onClick={() => setModal(null)}>
              <X size={18} />
            </button>
            <img src={personalImage} alt="" />
            <span className="eyebrow">{personalName}</span>
            <h3>{modalContent.title}</h3>
            <p>{modalContent.text}</p>
            <button type="button" className="metal-button" onClick={() => setModal(null)}>
              {modalContent.action}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
