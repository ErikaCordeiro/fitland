const WEEKDAYS = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

export function normalizeScheduleText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getWeekdayName(date = new Date()) {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? "" : WEEKDAYS[parsed.getDay()];
}

export function getWorkoutDay(workout) {
  const configuredDay = normalizeScheduleText(workout?.dayOfWeek || workout?.day_of_week || workout?.date);
  return WEEKDAYS.find((day) => configuredDay.includes(normalizeScheduleText(day))) || null;
}

export function getWorkoutsForDate(workouts = [], date = new Date()) {
  const weekday = normalizeScheduleText(getWeekdayName(date));
  return workouts.filter((workout) => normalizeScheduleText(getWorkoutDay(workout)) === weekday);
}

export function getRecommendedWorkout(workouts = [], date = new Date()) {
  return getWorkoutsForDate(workouts, date)[0] || null;
}

export function groupWorkoutsByWeekday(workouts = []) {
  const mondayFirst = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const grouped = Object.fromEntries(mondayFirst.map((day) => [day, []]));
  workouts.forEach((workout) => {
    const day = getWorkoutDay(workout);
    const displayDay = mondayFirst.find((item) => normalizeScheduleText(item) === normalizeScheduleText(day));
    if (displayDay) grouped[displayDay].push(workout);
  });
  return grouped;
}

export function getUnscheduledWorkouts(workouts = []) {
  return workouts.filter((workout) => !getWorkoutDay(workout));
}

export function getNextDays(total = 7, start = new Date()) {
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date,
      weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "").toUpperCase(),
      day: String(date.getDate()).padStart(2, "0"),
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "").toUpperCase()
    };
  });
}
