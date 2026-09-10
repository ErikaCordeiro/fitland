import React, { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Droplets,
  Flame,
  Leaf,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Utensils,
  X
} from "lucide-react";

const meals = [
  {
    time: "07:00",
    name: "Café da manhã",
    description: "Aveia com frutas, whey protein e chia",
    image: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=520&q=80",
    calories: 542,
    protein: 34,
    carbs: 68,
    fats: 14,
    notes: "Priorize a proteina antes do cafe.",
    substitutions: "Ovos mexidos, iogurte natural ou panqueca de banana.",
    done: true
  },
  {
    time: "10:30",
    name: "Lanche da manhã",
    description: "Iogurte natural com frutas e granola",
    image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=520&q=80",
    calories: 236,
    protein: 16,
    carbs: 28,
    fats: 6,
    notes: "Boa opcao para manter saciedade.",
    substitutions: "Whey com fruta, cottage ou mix de castanhas.",
    done: true
  },
  {
    time: "13:00",
    name: "Almoco",
    description: "Frango grelhado com arroz integral e legumes",
    image: "https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=520&q=80",
    calories: 680,
    protein: 48,
    carbs: 72,
    fats: 18,
    notes: "Refeição principal para energia e recuperação.",
    substitutions: "Patinho, tilapia, feijao, batata doce ou legumes assados.",
    done: true
  },
  {
    time: "16:30",
    name: "Lanche da tarde",
    description: "Maca com pasta de amendoim e castanhas",
    image: "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=520&q=80",
    calories: 210,
    protein: 6,
    carbs: 25,
    fats: 10,
    notes: "Use como pre-treino leve.",
    substitutions: "Banana com aveia, tapioca com ovo ou shake proteico.",
    done: true
  },
  {
    time: "19:30",
    name: "Jantar",
    description: "Salmao com batata doce e salada verde",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=520&q=80",
    calories: 610,
    protein: 46,
    carbs: 55,
    fats: 22,
    notes: "Jantar rico em proteina e micronutrientes.",
    substitutions: "Frango, carne magra, omelete, quinoa ou mandioca.",
    done: true
  },
  {
    time: "22:00",
    name: "Ceia",
    description: "Coalhada com chia e canela",
    image: "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=520&q=80",
    calories: 172,
    protein: 11,
    carbs: 12,
    fats: 4,
    notes: "Opcional caso sinta fome a noite.",
    substitutions: "Iogurte, caseina, leite proteico ou fruta pequena.",
    done: false
  }
];

const initialFoods = [
  { id: "food-1", name: "Arroz integral", amount: 150, unit: "g", calories: 170, protein: 4, carbs: 35, fats: 1 },
  { id: "food-2", name: "Peito de frango grelhado", amount: 120, unit: "g", calories: 198, protein: 37, carbs: 0, fats: 4 },
  { id: "food-3", name: "Feijao carioca", amount: 80, unit: "g", calories: 90, protein: 6, carbs: 16, fats: 1 },
  { id: "food-4", name: "Salada verde", amount: 50, unit: "g", calories: 15, protein: 1, carbs: 3, fats: 0 },
  { id: "food-5", name: "Azeite de oliva", amount: 10, unit: "ml", calories: 90, protein: 0, carbs: 0, fats: 10 }
];

const recipes = [
  {
    name: "Panqueca de banana com aveia",
    type: "Doce fit",
    calories: 280,
    protein: 18,
    carbs: 36,
    fats: 7,
    level: "Facil",
    time: "12 min",
    image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=520&q=80",
    ingredients: ["1 banana madura", "2 ovos", "3 colheres de aveia", "Canela", "1 scoop de whey opcional"],
    steps: ["Amasse a banana e misture os ovos.", "Adicione aveia e canela.", "Doure em frigideira antiaderente."]
  },
  {
    name: "Frango ao molho de mostarda",
    type: "Hipertrofia",
    calories: 520,
    protein: 48,
    carbs: 42,
    fats: 16,
    level: "Medio",
    time: "25 min",
    image: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=520&q=80",
    ingredients: ["150g de frango", "1 colher de mostarda", "Iogurte natural", "Arroz integral", "Legumes"],
    steps: ["Grelhe o frango.", "Misture mostarda com iogurte para o molho.", "Sirva com arroz e legumes."]
  },
  {
    name: "Brownie fit de chocolate",
    type: "Doces fit",
    calories: 180,
    protein: 12,
    carbs: 22,
    fats: 5,
    level: "Facil",
    time: "20 min",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=520&q=80",
    ingredients: ["Cacau 100%", "Banana", "Aveia", "Ovo", "Whey chocolate"],
    steps: ["Misture todos os ingredientes.", "Coloque em forma pequena.", "Asse até firmar."]
  },
  {
    name: "Marmita fitness completa",
    type: "Marmitas",
    calories: 450,
    protein: 38,
    carbs: 48,
    fats: 11,
    level: "Facil",
    time: "30 min",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=520&q=80",
    ingredients: ["Frango desfiado", "Arroz integral", "Feijao", "Brocolis", "Cenoura"],
    steps: ["Prepare a proteina em lote.", "Monte porcoes equilibradas.", "Congele por até 7 dias."]
  },
  {
    name: "Mousse proteico",
    type: "Pos treino",
    calories: 160,
    protein: 24,
    carbs: 12,
    fats: 3,
    level: "Facil",
    time: "8 min",
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=520&q=80",
    ingredients: ["Iogurte natural", "Whey", "Cacau", "Morango", "Chia"],
    steps: ["Misture iogurte, whey e cacau.", "Leve a geladeira.", "Finalize com morango e chia."]
  }
];

const lunchboxes = [
  ["Emagrecimento", "Frango, arroz integral, feijao e salada", "430 kcal", "42P / 46C / 9G"],
  ["Ganho de massa", "Patinho, batata doce, legumes e azeite", "620 kcal", "48P / 72C / 18G"],
  ["Low carb", "Omelete, legumes, abacaté e folhas", "390 kcal", "32P / 14C / 24G"],
  ["Economica", "Ovos, arroz, feijao, cenoura e couve", "470 kcal", "28P / 62C / 12G"],
  ["Rapida", "Atum, mandioca, tomaté e pepino", "410 kcal", "35P / 44C / 8G"],
  ["Congelavel", "Frango desfiado, pure de abobora e brocolis", "360 kcal", "38P / 30C / 8G"]
];

const NUTRITION_GOALS_KEY = "ptf_student_nutrition_goals_v1";
const MEAL_LOGS_KEY = "ptf_student_meal_logs_v1";
const WATER_LOG_KEY = "ptf_student_water_today_v1";

const defaultGoals = {
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
  fiber: ""
};

const metricConfig = [
  ["Calorias diárias", "calories", "kcal", Flame],
  ["Proteínas", "protein", "g", Utensils],
  ["Carboidratos", "carbs", "g", Leaf],
  ["Gorduras", "fats", "g", Droplets],
  ["Fibras", "fiber", "g", Apple]
];

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default function StudentDiet({ student, branding }) {
  const [water, setWater] = useState(() => Number(readStorage(WATER_LOG_KEY, 0)) || 0);
  const [waterAmount, setWaterAmount] = useState("300");
  const [foods, setFoods] = useState([]);
  const [mealLogs, setMealLogs] = useState(() => readStorage(MEAL_LOGS_KEY, []));
  const [nutritionGoals, setNutritionGoals] = useState(() => readStorage(NUTRITION_GOALS_KEY, defaultGoals));
  const [goalDraft, setGoalDraft] = useState(() => readStorage(NUTRITION_GOALS_KEY, defaultGoals));
  const [mealName, setMealName] = useState("Almoco");
  const [mealTime, setMealTime] = useState("13:00");
  const [mealPhoto, setMealPhoto] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [modal, setModal] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const waterGoal = useMemo(() => {
    const weightGoal = Number(student?.weight || 68) * 0.035;
    return Math.max(2.6, Math.min(3.5, weightGoal + 0.35));
  }, [student]);
  const waterPercent = Math.min(100, Math.round((water / waterGoal) * 100));
  const loggedTotals = mealLogs.reduce((totals, meal) => {
    totals.calories += Number(meal.calories || 0);
    totals.protein += Number(meal.protein || 0);
    totals.carbs += Number(meal.carbs || 0);
    totals.fats += Number(meal.fats || 0);
    totals.fiber += Number(meal.fiber || 0);
    return totals;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });
  const dailyStats = metricConfig.map(([label, key, unit, Icon]) => {
    const value = loggedTotals[key] || 0;
    const goal = Number(nutritionGoals[key] || 0);
    const percent = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
    return [label, value ? `${value.toLocaleString("pt-BR")}${unit === "kcal" ? "" : unit}` : "0", goal ? `/ ${goal.toLocaleString("pt-BR")} ${unit}` : "/ defina a meta", percent, Icon];
  });
  const totalCalories = foods.reduce((sum, food) => sum + Number(food.calories || 0), 0);
  const totalProtein = foods.reduce((sum, food) => sum + Number(food.protein || 0), 0);
  const totalCarbs = foods.reduce((sum, food) => sum + Number(food.carbs || 0), 0);
  const totalFats = foods.reduce((sum, food) => sum + Number(food.fats || 0), 0);

  useEffect(() => {
    window.localStorage.setItem(MEAL_LOGS_KEY, JSON.stringify(mealLogs));
  }, [mealLogs]);

  useEffect(() => {
    window.localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(nutritionGoals));
  }, [nutritionGoals]);

  useEffect(() => {
    window.localStorage.setItem(WATER_LOG_KEY, JSON.stringify(water));
  }, [water]);

  const updateFood = (id, field, value) => {
    setFoods((current) => current.map((food) => food.id === id ? { ...food, [field]: value } : food));
  };

  const addFood = () => {
    setFoods((current) => [...current, {
      id: crypto.randomUUID(),
      name: "Novo alimento",
      amount: 100,
      unit: "g",
      calories: 100,
      protein: 5,
      carbs: 10,
      fats: 3
    }]);
  };

  const removeFood = (id) => {
    setFoods((current) => current.filter((food) => food.id !== id));
  };

  const registerWater = () => {
    const numeric = Number(String(waterAmount).replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const liters = numeric > 10 ? numeric / 1000 : numeric;
    setWater((current) => Math.min(waterGoal, Number((current + liters).toFixed(2))));
  };

  const saveMeal = () => {
    if (!mealName.trim() || foods.length === 0) {
      setSavedMessage("Informe o nome da refeição e pelo menos 1 alimento.");
      return;
    }
    const invalid = foods.some((food) => [food.amount, food.calories, food.protein, food.carbs, food.fats].some((value) => Number(value) < 0));
    if (invalid) {
      setSavedMessage("Calorias, quantidade e macros precisam ser números positivos.");
      return;
    }
    const log = {
      id: crypto.randomUUID(),
      name: mealName.trim(),
      time: mealTime,
      photo: mealPhoto,
      foods,
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fats: totalFats,
      fiber: 0,
      createdAt: new Date().toISOString()
    };
    setMealLogs((current) => [log, ...current].slice(0, 20));
    setSavedMessage("Refeição salva no histórico alimentar e enviada para o personal.");
    setFoods([]);
    setMealPhoto("");
    setModal(null);
  };

  const saveGoals = () => {
    setNutritionGoals(goalDraft);
    setSavedMessage("Metas nutricionais atualizadas.");
    setModal(null);
  };

  const openRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setModal("recipe");
  };

  const handleMealPhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMealPhoto(URL.createObjectURL(file));
    setFoods(initialFoods);
  };

  const saveRecipeAction = (message) => {
    setSavedMessage(message);
    setModal(null);
  };

  return (
    <section className="student-diet-page">
      <section className="nutrition-kpi-grid">
        {dailyStats.map(([label, value, goal, percent, Icon]) => (
          <article key={label} className="nutrition-kpi-card">
            <Icon size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{goal}</small>
            <div className="nutrition-progress"><span style={{ width: `${percent}%` }} /></div>
            <em>{percent ? `${percent}% da meta` : "aguardando registro"}</em>
          </article>
        ))}
      </section>

      <section className="nutrition-main-grid">
        <div className="nutrition-left-column">
          <article className="nutrition-card meals-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Suas refeições de hoje</p>
                <h2>Plano alimentar diário</h2>
              </div>
              <button type="button" onClick={() => setModal("goals")}>Definir metas</button>
            </div>
            <div className="meal-list empty-student-meals">
              {mealLogs.length ? mealLogs.map((meal) => (
                <article key={meal.id} className="meal-card logged-meal-card">
                  <time>{meal.time}</time>
                  {meal.photo ? <img src={meal.photo} alt={meal.name} /> : <div className="meal-placeholder-icon"><Utensils size={24} /></div>}
                  <div>
                    <h3>{meal.name}</h3>
                    <p>{meal.foods.length} alimento(s) registrados</p>
                    <span>{meal.calories} kcal - {meal.protein}g P - {meal.carbs}g C - {meal.fats}g G</span>
                  </div>
                  <button type="button" aria-label={`Detalhes de ${meal.name}`} onClick={() => setModal("plan")}>
                    <CheckCircle2 size={23} />
                  </button>
                </article>
              )) : (
                <div className="nutrition-empty-state">
                  <Utensils size={30} />
                  <strong>Nenhuma refeição registrada hoje</strong>
                  <p>Use o botão abaixo para adicionar sua primeira refeição com foto ou manualmente.</p>
                </div>
              )}
            </div>
            <button className="register-meal-button" type="button" onClick={() => setModal("meal") }>
              <Plus size={18} />
              Registrar refeição
            </button>
          </article>

          <article className="nutrition-card ai-meal-panel premium-ai-analysis">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Registrar refeição com IA</p>
                <h2>Análise alimentar por foto</h2>
              </div>
              <Sparkles size={22} />
            </div>
            <p className="ai-disclaimer">A análise por foto é uma estimativa. Você pode editar os alimentos e quantidades antes de salvar.</p>
            <div className={`ai-meal-grid compact-ai-preview ${mealPhoto ? "has-analysis" : "awaiting-photo"}`}>
              <div className="meal-photo-card empty-photo-card">
                {mealPhoto ? (
                  <img src={mealPhoto} alt="Refeição analisada" />
                ) : (
                  <div className="empty-meal-photo">
                    <Camera size={34} />
                    <strong>Adicionar foto do prato</strong>
                    <span>A leitura da comida aparece logo depois do envio.</span>
                  </div>
                )}
                <button type="button" onClick={() => setModal("meal")}><Camera size={18} /> Tirar foto ou enviar imagem</button>
              </div>
              {mealPhoto ? (
                <div className="ai-summary-panel">
                  <span>Alimentos identificados</span>
                  <strong>{foods.length} itens - {totalCalories} kcal</strong>
                  <p>{totalProtein}g proteina - {totalCarbs}g carboidratos - {totalFats}g gorduras</p>
                  <div className="ai-food-chips">
                    {foods.slice(0, 5).map((food) => <em key={food.id}>{food.name}</em>)}
                  </div>
                  <button type="button" onClick={() => setModal("meal")}>Editar análise</button>
                </div>
              ) : null}
            </div>
          </article>

          <div className="nutrition-bottom-grid">
            <article className="nutrition-card food-evolution-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Evolução alimentar</p>
                  <h2>últimos 7 dias</h2>
                </div>
                <span>Calorias</span>
              </div>
              <div className="food-bars">
                {[68, 82, 74, 79, 62, 88, 94].map((value, index) => (
                  <div key={index}>
                    <span style={{ height: `${value}%` }} />
                    <small>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"][index]}</small>
                  </div>
                ))}
              </div>
              <p>Adesao alimentar: 87% - Hidratação: {waterPercent}%</p>
            </article>

            <article className="nutrition-card tips-card">
              <p className="eyebrow">Dicas de hoje</p>
              <ul>
                <li>Beba água ao longo do dia, não tudo de uma vez.</li>
                <li>Priorize proteína em todas as refeições.</li>
                <li>Inclua fibras para melhorar saciedade e intestino.</li>
              </ul>
            </article>
          </div>
        </div>

        <aside className="nutrition-right-column">
          <article className="nutrition-card hydration-panel">
            <p className="eyebrow">Hidratação</p>
            <strong>{water.toFixed(1).replace(".", ",")} L <small>/ {waterGoal.toFixed(1).replace(".", ",")} L</small></strong>
            <span>{waterPercent}% da meta diária</span>
            <div className="water-drops">
              {Array.from({ length: 7 }).map((_, index) => <Droplets key={index} size={26} className={index < Math.round((waterPercent / 100) * 7) ? "active" : ""} />)}
            </div>
            <label>
              <span>Registrar água</span>
              <input value={waterAmount} onChange={(event) => setWaterAmount(event.target.value)} placeholder="300 ml ou 0.3 L" />
            </label>
            <button type="button" onClick={registerWater}>Registrar água</button>
          </article>

          <article className="nutrition-card water-recommendation">
            <p className="eyebrow">Recomendacao de água</p>
            <h2>{waterGoal.toFixed(1).replace(".", ",")} L</h2>
            <span>por dia</span>
            <p>Com base na sua avaliação física, objetivo, frequência de treino e peso atual, recomendamos esta meta diária.</p>
          </article>

          <article className="nutrition-card food-coach-card">
            <div>
              <p className="eyebrow">Coach IA <span>Novo</span></p>
              <h2>Seu assistente inteligente para te ajudar a evoluir na alimentação.</h2>
              <ul>
                <li>Sugerir receitas</li>
                <li>Montar marmitas</li>
                <li>Substituir alimentos</li>
                <li>Calcular refeição por foto</li>
              </ul>
              <button type="button">Abrir Coach IA</button>
            </div>
            <img src={branding?.logo_url || branding?.icon_url || "/fitland-icon.svg"} alt="" />
          </article>

          <article className="nutrition-card recipe-panel">
            <p className="eyebrow">Sugestões para você</p>
            <h2>Receitas gostosas e saudaveis</h2>
            <div className="recipe-list">
              {recipes.map((recipe) => (
                <article key={recipe.name}>
                  <img src={recipe.image} alt={recipe.name} />
                  <div>
                    <strong>{recipe.name}</strong>
                    <span>{recipe.type} - {recipe.calories} kcal - {recipe.level} - {recipe.time}</span>
                  </div>
                  <div className="recipe-buttons">
                    <button type="button" onClick={() => openRecipe(recipe)}>Ver receita</button>
                    <button type="button" onClick={() => saveRecipeAction(`${recipe.name} salva nas favoritas.`)}>Salvar</button>
                    <button type="button" onClick={() => saveRecipeAction(`${recipe.name} adicionada a dieta de hoje.`)}>Adicionar</button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="nutrition-card lunchbox-panel">
            <p className="eyebrow">Ideias de marmitas</p>
            {lunchboxes.map(([name, ingredients, calories, macros]) => (
              <div key={name}>
                <strong>{name}</strong>
                <span>{ingredients}</span>
                <small>{calories} - {macros}</small>
              </div>
            ))}
          </article>
        </aside>
      </section>

      {savedMessage && <div className="floating-save-message"><Check size={16} /> {savedMessage}</div>}

      <button className="mobile-meal-cta" type="button" onClick={() => setModal("meal")}>
        <Camera size={18} />
        Registrar refeição
      </button>

      {modal === "plan" && (
        <div className="nutrition-modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <article className="nutrition-modal daily-plan-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button>
            <p className="eyebrow">Plano alimentar completo</p>
            <h2>Seu dia nutricional</h2>
            <div className="daily-plan-list">
              {mealLogs.length ? mealLogs.map((meal) => (
                <div key={meal.id} className="daily-plan-meal">
                  <time>{meal.time}</time>
                  {meal.photo ? <img src={meal.photo} alt={meal.name} /> : <div className="meal-placeholder-icon"><Utensils size={24} /></div>}
                  <div>
                    <strong>{meal.name}</strong>
                    <p>{meal.foods.map((food) => food.name).join(", ") || "Registro criado pelo aluno."}</p>
                    <span>{meal.calories} kcal - {meal.protein}g P - {meal.carbs}g C - {meal.fats}g G</span>
                    <small>Registro salvo no histórico alimentar.</small>
                  </div>
                </div>
              )) : (
                <div className="nutrition-empty-state">
                  <Utensils size={30} />
                  <strong>Plano alimentar ainda vazio</strong>
                  <p>Defina suas metas e registre uma refeição para montar seu dia nutricional.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      )}

      {modal === "meal" && (
        <div className="nutrition-modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <article className="nutrition-modal meal-register-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Registrar refeição com IA</p>
                <h2>Análise alimentar por foto</h2>
              </div>
              <Bot size={24} />
            </div>
            <p className="ai-disclaimer">Envie uma foto do prato. Depois disso a IA monta uma estimativa editavel dos alimentos, peso e macros.</p>
            <div className={`meal-register-grid ${mealPhoto ? "has-analysis" : "awaiting-photo"}`}>
              <div className="meal-upload-card">
                {mealPhoto ? (
                  <img src={mealPhoto} alt="Imagem da refeição" />
                ) : (
                  <div className="empty-meal-photo modal-empty-photo">
                    <Camera size={42} />
                    <strong>Foto vazia</strong>
                    <span>Toque no botão abaixo para enviar ou tirar a foto da refeição.</span>
                  </div>
                )}
                <label>
                  <Camera size={18} />
                  Tirar foto ou enviar imagem
                  <input type="file" accept="image/*" capture="environment" onChange={handleMealPhotoUpload} />
                </label>
              </div>
              {mealPhoto ? (
              <div className="meal-editor-panel">
                <div className="meal-editor-head">
                  <label>
                    <span>Nome da refeição</span>
                    <input value={mealName} onChange={(event) => setMealName(event.target.value)} />
                  </label>
                  <label>
                    <span>Horario</span>
                    <input value={mealTime} onChange={(event) => setMealTime(event.target.value)} />
                  </label>
                </div>
                <div className="food-table enhanced-food-table">
                  <div className="food-table-labels"><span>Alimento</span><span>Qtd</span><span>Un</span><span>Kcal</span><span>P</span><span>C</span><span>G</span><span></span></div>
                  {foods.map((food) => (
                    <div className="food-row" key={food.id}>
                      <input value={food.name} onChange={(event) => updateFood(food.id, "name", event.target.value)} aria-label="Alimento" />
                      <input value={food.amount} type="number" min="0" onChange={(event) => updateFood(food.id, "amount", event.target.value)} aria-label="Quantidade" />
                      <input value={food.unit} onChange={(event) => updateFood(food.id, "unit", event.target.value)} aria-label="Unidade" />
                      <input value={food.calories} type="number" min="0" onChange={(event) => updateFood(food.id, "calories", event.target.value)} aria-label="Calorias" />
                      <input value={food.protein} type="number" min="0" onChange={(event) => updateFood(food.id, "protein", event.target.value)} aria-label="Proteinas" />
                      <input value={food.carbs} type="number" min="0" onChange={(event) => updateFood(food.id, "carbs", event.target.value)} aria-label="Carboidratos" />
                      <input value={food.fats} type="number" min="0" onChange={(event) => updateFood(food.id, "fats", event.target.value)} aria-label="Gorduras" />
                      <button type="button" onClick={() => removeFood(food.id)} aria-label="Remover alimento"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <div className="meal-total-card">
                  <span>Total estimado</span>
                  <strong>{totalCalories} kcal</strong>
                  <small>{totalProtein}g P - {totalCarbs}g C - {totalFats}g G</small>
                </div>
                <div className="identified-actions">
                  <button type="button" onClick={addFood}><Plus size={16} /> Adicionar alimento</button>
                  <button type="button" onClick={saveMeal}><Save size={16} /> Salvar refeição</button>
                </div>
              </div>
              ) : null}
            </div>
          </article>
        </div>
      )}


      {modal === "goals" && (
        <div className="nutrition-modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <article className="nutrition-modal nutrition-goals-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button>
            <p className="eyebrow">Metas do dia</p>
            <h2>Defina seus números</h2>
            <div className="nutrition-goal-grid">
              {metricConfig.map(([label, key, unit]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input type="number" min="0" value={goalDraft[key] || ""} placeholder={unit} onChange={(event) => setGoalDraft((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            <button className="calendar-metal-button" type="button" onClick={saveGoals}>Salvar metas</button>
          </article>
        </div>
      )}
      {modal === "recipe" && selectedRecipe && (
        <div className="nutrition-modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <article className="nutrition-modal recipe-detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button>
            <div className="recipe-detail-grid">
              <img src={selectedRecipe.image} alt={selectedRecipe.name} />
              <div>
                <p className="eyebrow">{selectedRecipe.type}</p>
                <h2>{selectedRecipe.name}</h2>
                <div className="recipe-macro-grid">
                  <span>{selectedRecipe.calories} kcal</span>
                  <span>{selectedRecipe.protein}g proteina</span>
                  <span>{selectedRecipe.carbs}g carbs</span>
                  <span>{selectedRecipe.fats}g gorduras</span>
                  <span>{selectedRecipe.time}</span>
                  <span>{selectedRecipe.level}</span>
                </div>
                <h3>Ingredientes</h3>
                <ul>{selectedRecipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
                <h3>Modo de preparo</h3>
                <ol>{selectedRecipe.steps.map((item) => <li key={item}>{item}</li>)}</ol>
                <div className="recipe-modal-actions">
                  <button type="button" onClick={() => saveRecipeAction(`${selectedRecipe.name} salva nas favoritas.`)}>Salvar</button>
                  <button type="button" onClick={() => saveRecipeAction(`${selectedRecipe.name} adicionada a dieta de hoje.`)}>Adicionar a dieta</button>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
