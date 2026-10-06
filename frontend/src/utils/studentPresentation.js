export function hasStudentValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function formatStudentValue(value, unit = "") {
  if (!hasStudentValue(value)) return "—";
  return unit ? `${value} ${unit}` : String(value);
}

export function studentSummary(student = {}) {
  return {
    age: formatStudentValue(student.age, "anos"),
    weight: formatStudentValue(student.weight, "kg"),
    height: formatStudentValue(student.height, "m"),
    objective: formatStudentValue(student.objective),
  };
}

export function optionalFormNumber(value) {
  const normalized = String(value ?? "").trim();
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
