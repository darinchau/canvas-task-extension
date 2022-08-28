import postReq from './postReq';

/* Create a custom task item (Planner note). */
export default async function createCustomTask(
  title: string,
  date: string,
  course_id?: number
): Promise<void> {
  const data: Record<string, string | number> = {
    title: title,
    todo_date: date,
  };

  if (course_id && course_id > 0) data['course_id'] = course_id;
  await postReq('/v1/planner_notes', JSON.stringify(data));
}
