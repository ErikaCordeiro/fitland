export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthRange(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const startDate = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 41);
  return { start: localDateKey(startDate), end: localDateKey(endDate), startDate };
}

export function calendarDays(month) {
  const { startDate } = monthRange(month);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return { key: localDateKey(date), day: date.getDate(), currentMonth: date.getMonth() === month.getMonth() };
  });
}
