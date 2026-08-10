import { Zap, HeartPulse, Wrench, Thermometer, HardHat, FileQuestion, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  zap: Zap,
  "heart-pulse": HeartPulse,
  wrench: Wrench,
  thermometer: Thermometer,
  "hard-hat": HardHat,
};

export function ProfessionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? FileQuestion;
  return <Icon className={className} aria-hidden="true" />;
}
