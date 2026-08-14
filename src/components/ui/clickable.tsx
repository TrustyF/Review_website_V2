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

// Stand-in for <button> — every browser ships its own opinionated button
// defaults (font, padding, appearance, line-height) that fight custom
// styling and render inconsistently across engines, so this codebase avoids
// the element entirely for anything that isn't a plain form submit. role
//="button" plus manual Enter/Space handling keeps it keyboard-operable
// without any of that baggage (same pattern MediaSortPopover already used
// inline — this just gives it one shared home).
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
