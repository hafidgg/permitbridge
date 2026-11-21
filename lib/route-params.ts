import params from "@/lib/generated/route-params.json";

/** Params each dynamic route prebuilds (scripts/generate-route-params.ts). Checked before any data/ lookup. */
const guides = new Set(params.guides);
const states = new Set(params.states);
const professions = new Set(params.professions);
const transfers = new Set(params.transfers);

export const isKnownGuide = (slug: string) => guides.has(slug);
export const isKnownState = (slug: string) => states.has(slug);
export const isKnownProfession = (slug: string) => professions.has(slug);
export const isKnownTransfer = (profession: string, from: string, to: string) => transfers.has(`${profession}/${from}/${to}`);
