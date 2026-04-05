export const ACADEMIC_COURSE_YEARS = 2;

export function formatCourseSession(startYear: number) {
  return `${startYear}-${startYear + ACADEMIC_COURSE_YEARS}`;
}

export function getCurrentAcademicSession(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year - 1 : year - 2;
  return formatCourseSession(startYear);
}

export function getAcademicSessionOptions(baseDate = new Date(), total = 6) {
  const currentSession = getCurrentAcademicSession(baseDate);
  const currentStartYear = Number(currentSession.slice(0, 4));
  const firstStartYear = currentStartYear - 2;

  return Array.from({ length: total }, (_, index) => formatCourseSession(firstStartYear + index));
}

export function convertLegacySessionLabel(value: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(value || '').trim());
  if (!match) return value;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear - startYear === 2) {
    return value;
  }

  return formatCourseSession(startYear);
}

export function academicSessionsMatch(actualValue: string, selectedValue: string) {
  if (!selectedValue) {
    return true;
  }

  return convertLegacySessionLabel(actualValue) === convertLegacySessionLabel(selectedValue);
}
