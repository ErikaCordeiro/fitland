import React, { useState } from "react";
import {
  AlertTriangle,
  Apple,
  Camera,
  CheckCircle2,
  Droplets,
  Flame,
  Plus,
  Save,
  Sparkles,
  Utensils,
  X
} from "lucide-react";

const nutritionStats = [
  { label: "Planos ativos", value: "1", detail: "Erika", icon: Apple },
  { label: "Aderência média", value: "91%", detail: "+8% vs mês anterior", icon: CheckCircle2 },
  { label: "Refeições registradas", value: "18", detail: "últimos 7 dias", icon: Utensils },
  { label: "Hidratação média", value: "72%", detail: "meta diária", icon: Droplets },
  { label: "Alertas nutricionais", value: "3", detail: "precisam de atenção", icon: AlertTriangle }
];

const studentRows = [
  {
    name: "Erika Gomes",
    objective: "Perda de gordura",
    calories: "2.120 / 2.200 kcal",
    protein: "180g",
    water: "1,8 / 2,5 L",
    adherence: "92%",
    avatar: "/erika-gomes.jpeg",
    status: "Em dia"
  }
];

const meals = [
  { time: "07:00", name: "Café da manhã", student: "Erika", foods: "Aveia, whey, banana e chia", kcal: "542 kcal" },
  { time: "13:00", name: "Almoço", student: "Erika", foods: "Frango, arroz integral, feijao e salada", kcal: "680 kcal" },
  { time: "19:30", name: "Jantar", student: "Erika", foods: "Salmão com batata doce e legumes", kcal: "610 kcal" }
];

const alerts = [
  { text: "Erika ficou abaixo da meta de fibras", time: "Hoje, 09:20" },
  { text: "1 refeição enviada por foto aguarda revisão", time: "Hoje, 11:45" }
];

export default function PersonalDiet({ students }) {
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [aiMeals, setAiMeals] = useState([]);
  const [notice, setNotice] = useState(null);
  const [plans, setPlans] = useState([
    { student: "Erika Gomes", name: "Plano definição premium", calories: "2.200", meals: "6", status: "Ativo" }
  ]);

  return <section className="nutrition-admin-page"><div className="tenant-data-state"><strong>Nenhum plano alimentar cadastrado</strong><span>Os planos aparecerão quando houver registros reais disponíveis.</span></div></section>;

  const generateAiDiet = () => {
    setAiMeals([
      { time: "07:00", name: "Café da manhã", foods: "Ovos mexidos, aveia, banana e chia", macros: "520 kcal - 35P / 58C / 16G" },
      { time: "10:30", name: "Lanche proteico", foods: "Iogurte natural, whey e morangos", macros: "280 kcal - 28P / 24C / 7G" },
      { time: "13:00", name: "Almoço", foods: "Frango grelhado, arroz integral, feijão e salada", macros: "650 kcal - 52P / 74C / 14G" },
      { time: "16:30", name: "Pré-treino", foods: "Banana, pasta de amendoim e café", macros: "260 kcal - 8P / 36C / 9G" },
      { time: "19:30", name: "Jantar", foods: "Tilápia, batata doce e legumes", macros: "540 kcal - 46P / 48C / 13G" },
      { time: "22:00", name: "Ceia", foods: "Coalhada, canela e castanhas", macros: "190 kcal - 15P / 10C / 9G" }
    ]);
  };

  const updateAiMeal = (index, field, value) => {
    setAiMeals((current) => current.map((meal, mealIndex) => mealIndex === index ? { ...meal, [field]: value } : meal));
  };

  const openNotice = (title, text) => setNotice({ title, text });

  const savePlan = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPlans((current) => [
      {
        student: form.get("student"),
        name: form.get("name"),
        calories: form.get("calories"),
        meals: form.get("meals"),
        status: "Ativo",
        aiMeals
      },
      ...current
    ]);
    setIsPlanModalOpen(false);
    setNotice({ title: "Dieta salva", text: "O plano alimentar foi salvo e já fica disponível para revisão do aluno." });
    event.currentTarget.reset();
  };

  return (
    <section className="personal-diet-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gestão nutricional</p>
          <h2>Dietas dos alunos</h2>
          <span>Crie planos, acompanhe refeições e revise registros alimentares em tempo real.</span>
        </div>
        <button className="nutrition-admin-button" type="button" onClick={() => setIsPlanModalOpen(true)}>
          <Plus size={18} />
          Novo plano alimentar
        </button>
      </div>

      <div className="nutrition-admin-grid">
        {nutritionStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="nutrition-admin-stat" key={stat.label}>
              <Icon size={21} />
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          );
        })}
      </div>

      <div className="nutrition-admin-layout">
        <article className="nutrition-admin-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Acompanhamento</p>
              <h2>Alunos e metas</h2>
            </div>
            <button type="button" onClick={() => openNotice("Filtros de dieta", "Filtro preparado para localizar alunos por objetivo, aderência, hidratação e status nutricional.")}>Filtrar</button>
          </div>
          <div className="nutrition-student-table">
            <div className="nutrition-table-head">
              <span>Aluno</span>
              <span>Calorias</span>
              <span>Proteína</span>
              <span>água</span>
              <span>Aderência</span>
              <span>Status</span>
            </div>
            {studentRows.map((row) => (
              <div className="nutrition-student-row" key={row.name}>
                <div>
                  <img src={row.avatar} alt={row.name} />
                  <span>
                    <strong>{row.name}</strong>
                    <small>{row.objective}</small>
                  </span>
                </div>
                <span className="nutrition-metric" data-label="Calorias">{row.calories}</span>
                <span className="nutrition-metric" data-label="Proteína">{row.protein}</span>
                <span className="nutrition-metric" data-label="Água">{row.water}</span>
                <span className="nutrition-metric" data-label="Aderência">{row.adherence}</span>
                <mark data-label="Status">{row.status}</mark>
              </div>
            ))}
          </div>
        </article>

        <aside className="nutrition-admin-panel">
          <p className="eyebrow">Alertas inteligentes</p>
          <h2>Hoje</h2>
          <div className="nutrition-alert-list">
            {alerts.map((alert) => (
              <div key={alert.text}>
                <AlertTriangle size={18} />
                <span><strong>{alert.text}</strong><time>{alert.time}</time></span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <article className="nutrition-admin-panel diet-plan-list">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Planos criados</p>
            <h2>Biblioteca alimentar</h2>
          </div>
          <button type="button" onClick={() => setIsPlanModalOpen(true)}>Adicionar dieta</button>
        </div>
        <div className="diet-plan-grid">
          {plans.map((plan) => (
            <div key={`${plan.student}-${plan.name}`}>
              <strong>{plan.name}</strong>
              <span>{plan.student}</span>
              <small>{plan.calories} kcal - {plan.meals} refeições</small>
              <mark>{plan.status}</mark>
            </div>
          ))}
        </div>
      </article>

      <div className="nutrition-admin-layout bottom">
        <article className="nutrition-admin-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Registros recentes</p>
              <h2>Refeições enviadas</h2>
            </div>
            <Camera size={22} />
          </div>
          <div className="nutrition-meal-review">
            {meals.map((meal) => (
              <div key={`${meal.student}-${meal.time}`}>
                <time>{meal.time}</time>
                <div>
                  <strong>{meal.name}</strong>
                  <span>{meal.student} - {meal.foods}</span>
                </div>
                <small>{meal.kcal}</small>
                <button type="button" onClick={() => openNotice("Revisão de refeição", `${meal.name}: ${meal.foods}. Registro pronto para aprovação, comentário ou ajuste nutricional.`)}>Revisar</button>
              </div>
            ))}
          </div>
        </article>

        <article className="nutrition-admin-panel coach">
          <Sparkles size={24} />
          <p className="eyebrow">Coach IA nutricional</p>
          <h2>Gerar dieta, marmita ou ajuste</h2>
          <p>Use a IA para criar planos, revisar fotos de refeição, sugerir substituições e resumir a evolução alimentar.</p>
          <div className="coach-admin-actions">
            <button type="button" onClick={() => { generateAiDiet(); setIsPlanModalOpen(true); }}>Gerar dieta</button>
            <button type="button" onClick={() => openNotice("Marmita sugerida", "Frango grelhado, arroz integral, feijão, legumes e azeite. Você pode usar como base e editar antes de enviar.")}>Criar marmita</button>
            <button type="button" onClick={() => openNotice("Análise alimentar", "A IA nutricional pode revisar foto, calorias e macros. A análise é estimativa e sempre editável pelo personal.")}>Analisar refeição</button>
          </div>
        </article>
      </div>


      {notice && (
        <div className="admin-action-modal-backdrop" role="dialog" aria-modal="true" aria-label={notice.title}>
          <div className="admin-action-modal">
            <button type="button" aria-label="Fechar" onClick={() => setNotice(null)}><X size={18} /></button>
            <p className="eyebrow">Dietas</p>
            <h3>{notice.title}</h3>
            <p>{notice.text}</p>
            <div>
              <button className="metal-button inline" type="button" onClick={() => setNotice(null)}>Entendi</button>
            </div>
          </div>
        </div>
      )}
      {isPlanModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Nova dieta">
          <form className="student-modal diet-plan-modal" onSubmit={savePlan}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Nova dieta</p>
                <h2>Criar plano alimentar</h2>
              </div>
              <button className="ai-diet-button" type="button" onClick={generateAiDiet}><Sparkles size={17} /> Gerar sugestão com IA</button>
              <button className="icon-button" type="button" aria-label="Fechar" onClick={() => setIsPlanModalOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                <span>Aluno</span>
                <select name="student" required defaultValue={students?.[0]?.name || "Erika Gomes Cordeiro"}>
                  {(students || []).map((student) => (
                    <option key={student.id} value={student.name}>{student.name}</option>
                  ))}
                </select>
              </label>
              <label><span>Nome da dieta</span><input name="name" required placeholder="Ex: Definição premium" /></label>
              <label><span>Calorias alvo</span><input name="calories" type="number" min="800" required placeholder="2200" /></label>
              <label><span>Refeições por dia</span><input name="meals" type="number" min="1" required placeholder="6" /></label>
              <label className="wide"><span>Macros</span><input name="macros" placeholder="Proteínas 180g, carboidratos 250g, gorduras 70g" /></label>
              <label className="wide"><span>Observações</span><textarea name="notes" rows="4" placeholder="Substituições, restrições, orientações e estratégia." /></label>
              <div className="wide ai-diet-editor">
                <div>
                  <span>Plano sugerido pela IA nutricional premium</span>
                  <small>Gere uma base inteligente e edite tudo antes de salvar para o aluno.</small>
                </div>
                {aiMeals.length === 0 ? (
                  <button type="button" onClick={generateAiDiet}><Sparkles size={17} /> Gerar plano alimentar editável</button>
                ) : aiMeals.map((meal, index) => (
                  <div className="ai-diet-meal" key={`${meal.time}-${meal.name}`}>
                    <input value={meal.time} onChange={(event) => updateAiMeal(index, "time", event.target.value)} aria-label="Horário" />
                    <input value={meal.name} onChange={(event) => updateAiMeal(index, "name", event.target.value)} aria-label="Refeição" />
                    <input value={meal.foods} onChange={(event) => updateAiMeal(index, "foods", event.target.value)} aria-label="Alimentos" />
                    <input value={meal.macros} onChange={(event) => updateAiMeal(index, "macros", event.target.value)} aria-label="Macros" />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setIsPlanModalOpen(false)}>Cancelar</button>
              <button className="metal-button inline" type="submit"><Save size={18} /> Salvar dieta</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}






