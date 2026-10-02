import type { Metadata } from "next";
import { Logo } from "@/components/logo/logo";
import { LogoSimple } from "@/components/logo/logo-simple";
import { LogoTag } from "@/components/logo/logo-tag";
import style from "./logo-dev.module.sass";

export const metadata: Metadata = { title: "Logo" };

export default function LogoDevPage() {
	return (
		<div className={style.wrapper}>
			<Logo />
			<LogoSimple />
			<LogoTag />
		</div>
	);
}
