// Typed access to content/ (ADR-003). Pages import from here, never from the
// JSON files directly, so a content edit that breaks the shape fails the build.
import eventJson from "@content/event.json";
import activityJson from "@content/activity.json";
import charmAndChatterJson from "@content/activities/charm-and-chatter.json";
import charmsJson from "@content/charms.json";

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

// Vibe ids are DB-checked (rsvps.vibe CHECK in 0006): the migration lists
// them literally, so keep content/charms.json vibes in step with it.
export type VibeId = (typeof charms.vibes)[number]["id"];

export type CharmCategory = { id: string; label: string };
export type Charm = { id: string; label: string; category: string };
// A pairing group: a few style families. Each family belongs to one vibe.
export type Vibe = { id: string; label: string; categories: string[]; blurb: string };

// The charm catalogue for the bracelet builder. Images live at
// public/charms/<id>.webp; removing a charm here removes it from the site.
export type CharmsContent = {
  intro: string;
  note: string;
  // Under the copy button: what the bracelet link does.
  shareHint: string;
  vibes: Vibe[];
  // Shown with the visitor's vibe; {vibe} is replaced with its label.
  vibeTable: string;
  linkCount: number;
  pickCount: number;
  // Sample bracelet on the landing page.
  heroCharms: string[];
  categories: CharmCategory[];
  charms: Charm[];
};

// The active interactive module (ADR-005): one config pointer.
export type ActivityConfig = { active: string };

export const event: EventContent = eventJson;
export const activity: ActivityContent = charmAndChatterJson;
export const activityConfig: ActivityConfig = activityJson;
export const charms: CharmsContent = charmsJson;

// Every style family must belong to exactly one vibe, or pairing breaks;
// checked at build time so a content edit cannot ship a gap.
for (const cat of charms.categories) {
  const owners = charms.vibes.filter((v) => v.categories.includes(cat.id));
  if (owners.length !== 1) {
    throw new Error(`content/charms.json: category "${cat.id}" is in ${owners.length} vibes, expected 1`);
  }
}
