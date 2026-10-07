"use client";
import { useState } from "react";
import { Dice5 } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./spin-button.module.sass";

type Props = {
	onSpin: () => void;
	pending: boolean;
};

// "Spin again" control shared by the home page's random sections.
export function SpinButton({ onSpin, pending }: Props) {
	const dict = useDictionary();
	// Cumulative, so each spin turns the die a further 90° instead of snapping back.
	const [rotation, setRotation] = useState(0);

	function spin() {
		setRotation((deg) => deg + 90);
		onSpin();
	}

	return (
		<Clickable
			onClick={spin}
			disabled={pending}
			className={styles.spin}
			aria-label={dict.home.spinAgain}>
			<Dice5
				size={16}
				className={styles.icon}
				style={{ transform: `rotate(${rotation}deg)` }}
			/>
			{dict.home.spinAgain}
		</Clickable>
	);
}
