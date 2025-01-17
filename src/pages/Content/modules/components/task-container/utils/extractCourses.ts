import { AssignmentType, Course, FinalAssignment } from '../../../types';

/* Returns a list of `Course` objects from a list of `Assignment` objects. */
export default function extractCourses(
  assignments: FinalAssignment[]
): Course[] {
  return Object.values(
    assignments.reduce((a: Record<string, Course>, b: FinalAssignment) => {
      if (b.type !== AssignmentType.ANNOUNCEMENT && !(b.course_id in a)) {
        a[b.course_id] = {
          name: b.course_name,
          id: b.course_id,
          color: b.color,
          position: b.position,
        };
      }
      return a;
    }, {})
  );
}
