// Typed access to content/ (ADR-003). Pages import from here, never from the
// JSON files directly, so a content edit that breaks the shape fails the build.
import eventJson from "@content/event.json";
import activityJson from "@content/activity.json";
import charmAndChatterJson from "@content/activities/charm-and-chatter.json";

export type TimelineStep = { label: string; detail: string; done: boolean };
export type ScheduleItem = { time: string; detail: string };

export type EventContent = {
  name: string;
  theme: string;
  host: string;
  cohort: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  summary: string;
  description: string;
  status: string;
  schedule: ScheduleItem[];
  timeline: TimelineStep[];
};

export type ActivityContent = {
  id: string;
  name: string;
  tagline: string;
  howItWorks: string[];
  pairingRule: string;
  materials: string[];
};

// The active interactive module (ADR-005): one config pointer.
export type ActivityConfig = { active: string };

export const event: EventContent = eventJson;
export const activity: ActivityContent = charmAndChatterJson;
export const activityConfig: ActivityConfig = activityJson;
