import { Logo } from "@/components/logo/logo";
import { LogoSimple } from "@/components/logo/logo-simple";
import { LogoTag } from "@/components/logo/logo-tag";
import style from "./logo-dev.module.sass";

export default function LogoDevPage() {
	return (
		<div className={style.wrapper}>
			<Logo />
			<LogoSimple />
			<LogoTag />
		</div>
	);
}
