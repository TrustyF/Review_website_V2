import { notFound } from "next/navigation";
import { GaugePlayground } from "./gauge-playground";

export default function GaugesDevPage() {
	if (process.env.NODE_ENV !== "development") notFound();

	return <GaugePlayground />;
}
