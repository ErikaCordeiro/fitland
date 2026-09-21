import React, { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Camera,
  FileDown,
  Filter,
  Plus,
  Printer,
  Ruler,
  Scale,
  Search,
  Send,
  UserRound
} from "lucide-react";

const bodyMeasures = [
  ["Pescoço", "neck"],
  ["Ombro", "shoulder"],
  ["Peito", "chest"],
  ["Cintura", "waist"],
  ["Abdômen", "abdômen"],
  ["Quadril", "hip"],
  ["Braço", "arm"],
  ["Antebraço", "forearm"],
  ["Coxa", "thigh"],
  ["Panturrilha", "calf"]
];

const skinfolds = [
  ["Peitoral", "12"],
  ["Abdominal", "18"],
  ["Tricipital", "14"],
  ["Subescapular", "13"],
  ["Axilar média", "14"],
  ["Suprailiaca", "16"],
  ["Coxa", "15"]
];

const history = [
  ["18/06/2025", "72,4 kg", "25,6", "24,3%", "54,1 kg"],
  ["20/05/2025", "74,1 kg", "26,2", "25,7%", "52,7 kg"],
  ["22/04/2025", "75,3 kg", "26,7", "27,1%", "51,8 kg"],
  ["18/03/2025", "77,8 kg", "27,5", "28,3%", "51,1 kg"]
];

const quickActions = [
  ["Nova avaliação", Plus],
  ["Comparar avaliações", BarChart3],
  ["Gerar relatório", FileDown],
  ["Exportar PDF", FileDown],
  ["Ver evolução gráfica", BarChart3],
  ["Enviar para aluno", Send],
  ["Imprimir avaliação", Printer],
  ["Agendar próxima", CalendarDays]
];

function classifyBmi(bmi) {
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidade";
}

function classifyFat(value) {
  if (value < 18) return "Excelente";
  if (value < 25) return "Moderado";
  return "Atenção";
}

export default function PersonalAssessments({ students }) {
  return <section className="assessments-admin-page"><div className="tenant-data-state"><strong>Nenhuma avaliação disponível</strong><span>As avaliações aparecerão quando houver registros persistidos.</span></div></section>;
  const [selectedStudent, setSelectedStudent] = useState(null);
  const assessmentStudent = selectedStudent || students?.[0] || {};
  const [basic, setBasic] = useState({
    date: "2025-06-21",
    weight: "72.4",
    height: "168",
    age: "28",
    sex: "female"
  });
  const [measures, setMeasures] = useState({
    neck: "34.2",
    shoulder: "108.5",
    chest: "98.0",
    waist: "78.2",
    abdômen: "85.4",
    hip: "102.3",
    arm: "30.5",
    forearm: "26.1",
    thigh: "56.1",
    calf: "36.2"
  });

  const calculations = useMemo(() => {
    const weight = Number(basic.weight) || 0;
    const heightCm = Number(basic.height) || 0;
    const heightM = heightCm > 3 ? heightCm / 100 : heightCm;
    const age = Number(basic.age) || 0;
    const bmi = heightM > 0 ? weight / (heightM * heightM) : 0;
    const bmr = basic.sex === "female"
      ? 10 * weight + 6.25 * heightCm - 5 * age - 161
      : 10 * weight + 6.25 * heightCm - 5 * age + 5;
    const sumSkinfolds = skinfolds.reduce((total, [, value]) => total + Number(value), 0);
    const density = basic.sex === "female"
      ? 1.0994921 - 0.0009929 * sumSkinfolds + 0.0000023 * sumSkinfolds ** 2 - 0.0001392 * age
      : 1.10938 - 0.0008267 * sumSkinfolds + 0.0000016 * sumSkinfolds ** 2 - 0.0002574 * age;
    const fatPercent = density > 0 ? (495 / density) - 450 : 0;
    const fatMass = weight * fatPercent / 100;
    const leanMass = weight - fatMass;
    const water = leanMass * 0.73;

    return {
      bmi,
      bmr,
      fatPercent,
      fatMass,
      leanMass,
      water
    };
  }, [basic]);

  const updateBasic = (field, value) => {
    setBasic((current) => ({ ...current, [field]: value }));
  };

  const updateMeasure = (field, value) => {
    setMeasures((current) => ({ ...current, [field]: value }));
  };

  if (!selectedStudent) {
    return (
      <section className="personal-assessment-page">
        <div className="assessment-admin-header">
          <div>
            <h2>Avaliações físicas</h2>
            <p>Selecione um aluno para abrir a avaliação individual completa, com medidas, fotos, histórico e relatórios.</p>
          </div>
          <label>
            <Search size={18} />
            <input placeholder="Buscar aluno..." />
          </label>
          <button type="button" onClick={() => setSelectedStudent(students?.[0])}><Plus size={18} /> Incluir avaliação física</button>
          <button type="button"><Filter size={18} /> Filtros</button>
        </div>

        <div className="assessment-student-cards">
          {(students || []).map((student, index) => (
            <button type="button" key={student.id} onClick={() => setSelectedStudent(student)}>
              <img src={student.avatar || "/erika-gomes.jpeg"} alt={student.name} />
              <div>
                <strong>{student.name}</strong>
                <span>{student.objective}</span>
                <small>Última avaliação: {index === 0 ? "18/06/2025" : "21/06/2025"}</small>
              </div>
              <mark>{index === 0 ? "78%" : "64%"}</mark>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="personal-assessment-page">
      <div className="assessment-admin-header">
        <div>
          <h2>Avaliação física</h2>
          <p>Registre, acompanhe e analise a evolução física dos seus alunos.</p>
        </div>
        <label>
          <Search size={18} />
          <input placeholder="Buscar aluno..." />
        </label>
        <button type="button"><Plus size={18} /> Incluir avaliação física</button>
        <button type="button"><Filter size={18} /> Filtros</button>
      </div>

      <article className="assessment-admin-profile">
        <img src={assessmentStudent.avatar || "/erika-gomes.jpeg"} alt={assessmentStudent.name || "Erika Gomes"} />
        <div>
          <button className="assessment-back-button" type="button" onClick={() => setSelectedStudent(null)}>← Voltar para alunos</button>
          <h3>{assessmentStudent.name || "Erika Gomes"}</h3>
          <span>
            <UserRound size={15} /> {basic.age} anos
            <Ruler size={15} /> {(Number(basic.height) / 100).toFixed(2).replace(".", ",")} m
            <Scale size={15} /> Emagrecimento
          </span>
        </div>
        <dl>
          <div><dt>Início</dt><dd>03/03/2025</dd></div>
          <div><dt>Última avaliação</dt><dd>18/06/2025</dd></div>
          <div><dt>Próxima avaliação</dt><dd>18/09/2025</dd></div>
          <div><dt>Total</dt><dd>4 avaliações</dd></div>
        </dl>
      </article>

      <div className="assessment-admin-grid">
        <article className="assessment-admin-card basic">
          <h3>1. Medidas básicas</h3>
          <div className="assessment-form-grid">
            <label>
              Data da avaliação
              <input type="date" value={basic.date} onChange={(event) => updateBasic("date", event.target.value)} />
            </label>
            <label>
              Peso (kg)
              <input type="number" min="0" step="0.1" value={basic.weight} onChange={(event) => updateBasic("weight", event.target.value)} />
            </label>
            <label>
              Altura (cm)
              <input type="number" min="0" step="1" value={basic.height} onChange={(event) => updateBasic("height", event.target.value)} />
            </label>
            <label>
              Idade
              <input type="number" min="0" step="1" value={basic.age} onChange={(event) => updateBasic("age", event.target.value)} />
            </label>
          </div>
          <div className="assessment-radio-row">
            <button className={basic.sex === "female" ? "active" : ""} type="button" onClick={() => updateBasic("sex", "female")}>Feminino</button>
            <button className={basic.sex === "male" ? "active" : ""} type="button" onClick={() => updateBasic("sex", "male")}>Masculino</button>
          </div>
        </article>

        <article className="assessment-admin-card calculations">
          <h3>2. Cálculos automáticos</h3>
          <div className="calculation-grid">
            <div><span>IMC</span><strong>{calculations.bmi.toFixed(1).replace(".", ",")}</strong><small>{classifyBmi(calculations.bmi)}</small></div>
            <div><span>TMB</span><strong>{Math.round(calculations.bmr)}</strong><small>kcal/dia</small></div>
            <div><span>Gordura corporal</span><strong>{calculations.fatPercent.toFixed(1).replace(".", ",")}%</strong><small>{classifyFat(calculations.fatPercent)}</small></div>
            <div><span>Massa magra</span><strong>{calculations.leanMass.toFixed(1).replace(".", ",")} kg</strong><small>Adequado</small></div>
            <div><span>Massa gorda</span><strong>{calculations.fatMass.toFixed(1).replace(".", ",")} kg</strong><small>Monitorar</small></div>
            <div><span>água corporal</span><strong>{calculations.water.toFixed(1).replace(".", ",")} L</strong><small>Adequado</small></div>
          </div>
          <p>* Calculos baseados em Mifflin-St Jeor, Jackson & Pollock e estimativas corporais.</p>
        </article>

        <article className="assessment-admin-card body-measures">
          <h3>3. Medidas corporais <small>cm</small></h3>
          <div className="measure-list">
            {bodyMeasures.map(([label, key]) => (
              <label key={key}>
                <span>{label}</span>
                <input type="number" min="0" step="0.1" value={measures[key]} onChange={(event) => updateMeasure(key, event.target.value)} />
              </label>
            ))}
          </div>
          <button type="button"><Plus size={17} /> Adicionar medida</button>
        </article>

        <article className="assessment-admin-card skinfold-card">
          <h3>4. Dobras cutâneas (adipômetro) <small>mm</small></h3>
          <div className="skinfold-layout">
            <div className="body-illustration" aria-label="Ilustração de pontos de medição com adipômetro">
              <span className="head" />
              <span className="torso" />
              <span className="arm left" />
              <span className="arm right" />
              <span className="leg left" />
              <span className="leg right" />
              <i className="point chest" />
              <i className="point abdômen" />
              <i className="point thigh" />
            </div>
            <div className="skinfold-list">
              {skinfolds.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="fat-result">
            <span>Gordura corporal (Jackson-Pollock)</span>
            <strong>{calculations.fatPercent.toFixed(1).replace(".", ",")}%</strong>
            <small>Classificação: {classifyFat(calculations.fatPercent)}</small>
          </div>
        </article>

        <article className="assessment-admin-card photos">
          <h3>5. Fotos da avaliação</h3>
          <div className="assessment-photo-slots">
            {["Frontal", "Lateral", "Traseira"].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <img src={assessmentStudent.avatar || "/erika-gomes.jpeg"} alt={`${label} avaliação`} />
              </div>
            ))}
          </div>
          <button type="button"><Camera size={21} /> Adicionar novas fotos</button>
        </article>

        <article className="assessment-admin-card evolution">
          <h3>6. Evolução</h3>
          <div className="mini-chart-grid">
            {["Peso (kg)", "Gordura corporal (%)", "Massa magra (kg)", "IMC"].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{label === "IMC" ? calculations.bmi.toFixed(1).replace(".", ",") : label.includes("Gordura") ? `${calculations.fatPercent.toFixed(1).replace(".", ",")}%` : label.includes("Massa") ? `${calculations.leanMass.toFixed(1).replace(".", ",")} kg` : `${basic.weight.replace(".", ",")} kg`}</strong>
                <svg viewBox="0 0 180 92">
                  <polyline points="4,18 42,28 78,42 114,48 150,66 176,76" />
                  <circle cx="176" cy="76" r="4" />
                </svg>
              </div>
            ))}
          </div>
        </article>

        <article className="assessment-admin-card history">
          <h3>7. Histórico de avaliações</h3>
          <table>
            <thead>
              <tr><th>Data</th><th>Peso</th><th>IMC</th><th>Gordura</th><th>Massa magra</th></tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="assessment-admin-card notes">
          <h3>8. Observações do personal</h3>
          <textarea defaultValue="Excelente Evolução. Redução significativa de gordura corporal e aumento de massa magra. Continue mantendo consistência nos treinos e na alimentação." />
        </article>

        <article className="assessment-admin-card actions">
          <h3>9. Ações rápidas</h3>
          <div>
            {quickActions.map(([label, Icon]) => (
              <button type="button" key={label}>
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

