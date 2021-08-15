/*
  functions to get the previous and next occurence of a specific day of the week
*/

export function getWeekStart(startDate: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - startDate + 7) % 7));
  d.setHours(0, 0, 0);
  return d;
}
export function getWeekEnd(startDate: number): Date {
  const d = new Date();
  if (d.getDay() != startDate) {
    d.setDate(d.getDate() + ((startDate + 7 - d.getDay()) % 7));
  } else {
    d.setDate(d.getDate() + 7);
  }
  d.setHours(0, 0, 0);
  return d;
}