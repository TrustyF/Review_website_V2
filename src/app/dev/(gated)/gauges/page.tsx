import type { Metadata } from "next";
import { GaugePlayground } from "./gauge-playground";

export const metadata: Metadata = { title: "Gauges" };

export default function GaugesDevPage() {
	return <GaugePlayground />;
}
