import { STUDIO_STAGES, type StudioStage, type StudioTier } from "@/lib/enums";
import { TransitionError } from "@/lib/stateMachine/errors";
import { OPTIONAL_ONBOARDING_FLAGS, type Onboarding } from "@/lib/validation/studio";

/** spec §4.2. */

export interface StudioStateInput {
  stage: StudioStage;
  onboarding: Onboarding;
  tier?: StudioTier | null;
}

const MAIN_SEQUENCE: StudioStage[] = [
  "lead",
  "contacted",
  "negotiating",
  "agreement_sent",
  "onboarding",
  "active",
];

// Exits, allowed from any stage (§4.2). Not spec'd as reversible; allowing
// re-entry via "lead" only, so a paused/churned studio isn't a dead end.
const EXIT_STAGES = new Set<StudioStage>(["not_interested", "paused", "churned"]);

function isAllowedTransition(from: StudioStage, to: StudioStage): boolean {
  if (EXIT_STAGES.has(to)) return true;
  if (EXIT_STAGES.has(from)) return to === "lead";

  const fromIdx = MAIN_SEQUENCE.indexOf(from);
  const toIdx = MAIN_SEQUENCE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1 || toIdx === fromIdx - 1;
}

function runGuard(to: StudioStage, studio: StudioStateInput): void {
  if (to !== "active") return;
  if (!studio.tier) {
    throw new TransitionError("active requires tier to be set");
  }
  const requiredEntries = Object.entries(studio.onboarding).filter(
    ([key]) => !OPTIONAL_ONBOARDING_FLAGS.includes(key as keyof Onboarding)
  );
  if (requiredEntries.length === 0 || requiredEntries.some(([, value]) => value !== true)) {
    throw new TransitionError("active requires every required onboarding checklist item to be complete");
  }
}

export function assertValidStageTransition(studio: StudioStateInput, to: string): void {
  if (!(STUDIO_STAGES as readonly string[]).includes(to)) {
    throw new TransitionError(`Unknown stage: ${to}`);
  }
  const target = to as StudioStage;
  const from = studio.stage;

  if (from === target) {
    throw new TransitionError(`Studio is already ${target}`);
  }
  if (!isAllowedTransition(from, target)) {
    throw new TransitionError(`Cannot move studio from ${from} to ${target}`);
  }
  runGuard(target, studio);
}

/** Stages a studio may move to from `from` (guards still run server-side). */
export function allowedNextStages(from: StudioStage): StudioStage[] {
  return STUDIO_STAGES.filter((to) => to !== from && isAllowedTransition(from, to));
}

export function forwardStage(from: StudioStage): StudioStage | null {
  if (EXIT_STAGES.has(from)) return "lead";
  const idx = MAIN_SEQUENCE.indexOf(from);
  return idx >= 0 && idx < MAIN_SEQUENCE.length - 1 ? MAIN_SEQUENCE[idx + 1] : null;
}
