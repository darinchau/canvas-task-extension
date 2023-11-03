import axios from 'axios';
import {
  AssignmentType,
  FinalAssignment,
  Options,
  PlannerAssignment,
} from '../types';
import { useQuery, UseQueryResult } from 'react-query';
import dashCourses from '../utils/dashCourses';
import onCoursePage from '../utils/onCoursePage';
import useCourseNames from './useCourseNames';
import useCourseColors from './useCourseColors';
import baseURL from '../utils/baseURL';
import { DemoAssignments } from '../tests/demo';
import { AssignmentDefaults, OptionsDefaults } from '../constants';
import useCoursePositions from './useCoursePositions';
import isDemo from '../utils/isDemo';
import JSONBigInt from 'json-bigint';
import useNeedsGrading from './useNeedsGrading';

const parseLinkHeader = (link: string) => {
  const re = /<([^>]+)>; rel="([^"]+)"/g;
  let arrRes: RegExpExecArray | null;
  const ret: Record<string, { url: string; page: string }> = {};
  while ((arrRes = re.exec(link)) !== null) {
    ret[arrRes[2]] = {
      url: arrRes[1],
      page: arrRes[2],
    };
  }
  return ret;
};

export async function getPaginatedRequest<T>(
  url: string,
  recurse = false
): Promise<T[]> {
  try {
    const res = await axios.get(url, {
      transformResponse: [(data) => JSONBigInt.parse(data)],
    });

    if (recurse && 'link' in res.headers) {
      const parsed = parseLinkHeader(res.headers['link']);
      if (parsed && 'next' in parsed && parsed['next'].url !== url)
        return (res.data as T[]).concat(
          (await getPaginatedRequest(parsed['next'].url, true)) as T[]
        );
    }

    return res.data;
  } catch (err) {
    console.error(err);
    return []; // still return all successful pages if error instead of hanging
  }
}

/* Get assignments from api */
async function getAllAssignmentsRequest(
  start: string,
  end: string,
  allPages = true
): Promise<PlannerAssignment[]> {
  const initialURL = `${baseURL()}/api/v1/planner/items?start_date=${start}${
    end ? '&end_date=' + end : ''
  }&per_page=1000`;
  return await getPaginatedRequest<PlannerAssignment>(initialURL, allPages);
}

/* Merge api objects into Assignment objects. */
export function convertPlannerAssignments(
  assignments: PlannerAssignment[]
): FinalAssignment[] {
  return assignments.map((assignment) => {
    const converted: Partial<FinalAssignment> = {
      html_url:
        assignment.html_url || assignment.plannable.linked_object_html_url,
      type: assignment.plannable_type,
      id: assignment.plannable_id.toString(),
      plannable_id: assignment.plannable_id.toString(), // just in case it changes in the future
      override_id: assignment.planner_override?.id.toString(),
      course_id: (
        assignment.course_id || assignment.plannable.course_id
      )?.toString(),
      name: assignment.plannable.title,
      due_at:
        assignment.plannable.due_at ||
        assignment.plannable.todo_date ||
        assignment.plannable_date,
      points_possible: assignment.plannable.points_possible,
      submitted:
        assignment.submissions !== false
          ? assignment.submissions.submitted
          : undefined,
      graded:
        assignment.submissions !== false
          ? assignment.submissions.excused || assignment.submissions.graded
          : undefined,
      graded_at:
        assignment.submissions !== false
          ? assignment.submissions.posted_at
          : undefined,
      marked_complete:
        assignment.planner_override?.marked_complete ||
        assignment.planner_override?.dismissed ||
        (assignment.plannable_type === AssignmentType.ANNOUNCEMENT &&
          assignment.plannable.read_state === 'read'),
    };

    const full: FinalAssignment = {
      ...AssignmentDefaults,
    };

    Object.keys(converted).forEach((k) => {
      const prop = k as keyof FinalAssignment;
      if (converted[prop] !== null && typeof converted[prop] !== 'undefined')
        full[prop] = converted[prop] as never;
    });

    return full;
  });
}

/* Only assignments between the exact datetimes */
export function filterTimeBounds(
  startDate: Date,
  endDate: Date,
  assignments: FinalAssignment[]
): FinalAssignment[] {
  // Override the settings if it is sunday 2359 becuase we want to show the full week
  // function isMonday0000(date: Date): boolean {
  //   return (
  //     date.getDay() === 0 && date.getHours() === 23 && date.getMinutes() === 59
  //   );
  // }

  // // Make it Monday 0000 to sunday 2359
  // if (isSundayAt2359(startDate) && isSundayAt2359(endDate)) {
  //   const oneWeek = 7 * 24 * 60 * 60 * 1000;
  //   const timeDiff = endDate.getTime() - startDate.getTime();

  //   if (timeDiff === oneWeek) {
  //     startDate.setHours(0, 0, 0, 0);
  //     endDate.setHours(0, 0, 0, 0);
  //   }
  // }

  // console.log(`Filtering assignments between ${startDate} and ${endDate}`);
  return assignments.filter((assignment) => {
    const due_date = new Date(assignment.due_at);
    return (
      due_date.valueOf() >= startDate.valueOf() &&
      due_date.valueOf() < endDate.valueOf()
    );
  });
}

/* Only assignments from the specified courses */
export function filterCourses(
  courses: string[],
  assignments: FinalAssignment[]
): FinalAssignment[] {
  const courseSet = new Set(courses);
  return assignments.filter((assignment) => {
    return (
      (assignment.course_id === '0' || !!assignment.course_id) &&
      courseSet.has(assignment.course_id)
    );
  });
}

/* Only where type is assignment, discussion, quiz, or planner note */
export function filterAssignmentTypes(
  assignments: FinalAssignment[]
): FinalAssignment[] {
  const validAssignments = [
    AssignmentType.ASSIGNMENT,
    AssignmentType.DISCUSSION,
    AssignmentType.QUIZ,
    AssignmentType.NOTE,
    AssignmentType.ANNOUNCEMENT,
  ];
  return assignments.filter((assignment) =>
    validAssignments.includes(assignment.type)
  );
}

/* Fill out the `color` attribute in the assignment object. */
export function applyCourseColor(
  colors: Record<string, string>,
  assignments: FinalAssignment[]
): FinalAssignment[] {
  const applied = applyCourseValue('color', colors, assignments);
  // apply theme color for courses without a custom color
  return applied.map((a) => {
    if (!(a.course_id in colors)) a.color = colors['0'];
    return a;
  });
}

/* Fill out the `course_name` attribute in the assignment object. */
export function applyCourseName(
  names: Record<string, string>,
  assignments: FinalAssignment[]
): FinalAssignment[] {
  return applyCourseValue('course_name', names, assignments);
}

/* Fill out the `position` attribute in the assignment object. */
export function applyCoursePositions(
  positions: Record<string, number>,
  assignments: FinalAssignment[]
): FinalAssignment[] {
  return applyCourseValue('position', positions, assignments);
}

/* 
  Fill the `value` property of Assignment using the corresponding value to its course_id in `courseMap`.
  For DRY-ness.
 */
export function applyCourseValue(
  value: keyof FinalAssignment,
  courseMap: Record<string, string> | Record<string, number>,
  assignments: FinalAssignment[]
): FinalAssignment[] {
  return assignments.map((assignment) => {
    if (assignment.course_id in courseMap)
      assignment[value] = courseMap[assignment.course_id] as never;
    return assignment;
  });
}

/* Set the course name of custom tasks with no course name to "Custom Task" */
export function applyCustomTaskLabels(
  assignments: FinalAssignment[]
): FinalAssignment[] {
  return assignments.map((assignment) => {
    if (assignment.type === AssignmentType.NOTE && assignment.course_id === '0')
      assignment.course_name = 'Custom Task';

    return assignment;
  });
}

export async function getAllAssignments(
  startDate: Date,
  endDate: Date
): Promise<FinalAssignment[]> {
  /* Expand bounds by 1 day to account for possible time zone differences with api. */
  const st = new Date(startDate);
  st.setDate(startDate.getDate() - 1);
  const en = new Date(endDate);
  en.setDate(en.getDate() + 1);

  console.log(`Fucking1 assignments between ${startDate} and ${endDate}`);

  const startStr = st.toISOString().split('T')[0];
  const endStr = en.toISOString().split('T')[0];
  const data = isDemo()
    ? DemoAssignments
    : await getAllAssignmentsRequest(startStr, endStr);

  return convertPlannerAssignments(data as PlannerAssignment[]);
}

export function processAssignmentList(
  assignments: FinalAssignment[],
  startDate: Date,
  endDate: Date,
  options: Options,
  colors?: Record<string, string>,
  names?: Record<string, string>,
  positions?: Record<string, number>
): FinalAssignment[] {
  assignments = filterAssignmentTypes(assignments);
  assignments = filterTimeBounds(startDate, endDate, assignments);
  if (colors) assignments = applyCourseColor(colors, assignments);
  if (names) assignments = applyCourseName(names, assignments);
  if (positions) assignments = applyCoursePositions(positions, assignments);
  assignments = applyCustomTaskLabels(assignments);

  const coursePageId = onCoursePage();

  if (coursePageId !== false) {
    assignments = filterCourses([coursePageId], assignments);
  } else {
    const dash = dashCourses();
    if (options.dash_courses && dash)
      assignments = filterCourses(Array.from(dash).concat(['0']), assignments);
  }
  return assignments;
}

/** Process assignments as a list of assignment datas */
async function processAssignments(
  startDate: Date,
  endDate: Date,
  options: Options,
  colors?: Record<string, string>,
  names?: Record<string, string>,
  positions?: Record<string, number>
): Promise<FinalAssignment[]> {
  /* modify this filter if announcements are used in the future */
  const assignments = await getAllAssignments(startDate, endDate);
  return processAssignmentList(
    assignments,
    startDate,
    endDate,
    options,
    colors,
    names,
    positions
  );
}

/** Get all assignment data within start date and end date */
export default function useAssignments(
  startDate: Date,
  endDate: Date,
  options: Options
): UseQueryResult<FinalAssignment[]> {
  const { data: colors } = useCourseColors(
    options.theme_color !== OptionsDefaults.theme_color
      ? options.theme_color
      : undefined
  );
  const { data: names } = useCourseNames();
  const { data: positions } = useCoursePositions();
  const { data: needsGradingAssignments } = useNeedsGrading(endDate, options);
  return useQuery(
    ['names', startDate, endDate],
    async () => {
      return needsGradingAssignments?.concat(
        await processAssignments(
          startDate,
          endDate,
          options,
          colors as Record<string, string>,
          names as Record<string, string>,
          positions as Record<string, number>
        )
      );
    },
    {
      staleTime: Infinity,
      enabled: !!colors && !!names && !!needsGradingAssignments,
    }
  );
}
