/** Client-safe context for HUDD NEXUS assistant (meeting mode). */
export type AssistantMeetingContext = {
  meetingId: string;
  meetingDate: string;
  title: string | null;
  financialYearLabel: string;
};
