import { CSSProperties, KeyboardEvent, ReactNode } from "react";

type Props = {
	onClick?: () => void;
	children: ReactNode;
	className?: string | undefined;
	style?: CSSProperties | undefined;
	title?: string;
	disabled?: boolean;
	"aria-label"?: string;
	"aria-pressed"?: boolean;
	"aria-current"?: boolean | "true" | "false";
};

// Avoids button's browser defaults; role=button + Enter/Space keeps it keyboard-operable
export function Clickable({
	onClick,
	children,
	className,
	style,
	title,
	disabled,
	...aria
}: Props) {
	function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
		if (disabled) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		onClick?.();
	}

	return (
		<div
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled || undefined}
			className={className}
			style={style}
			title={title}
			onClick={disabled ? undefined : onClick}
			onKeyDown={handleKeyDown}
			{...aria}>
			{children}
		</div>
	);
}
