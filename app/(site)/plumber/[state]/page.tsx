import type { Metadata } from "next";
import { TradeStateSummaryPage, tradeStateMetadata } from "@/components/trade-state/TradeStateSummaryPage";
import { TRADE_SUMMARY_STATES } from "@/lib/trade-state-summary";

// Static segment: takes precedence over app/(site)/[profession]/[transfer], which (with its RN logic) is left untouched.
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return TRADE_SUMMARY_STATES.map((state) => ({ state }));
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  return tradeStateMetadata("plumber", (await params).state);
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  return <TradeStateSummaryPage profession="plumber" state={(await params).state} />;
}
