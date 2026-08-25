"use client";
import { useRef, useState } from "react";
import { UserRound, X } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { useOutsideClick } from "@/lib/use-outside-click";
import { AvatarGroup } from "@/lib/avatars";
import { updateAvatar } from "@/components/account/account-actions";
import styles from "./avatar-picker.module.sass";

type Props = {
	initialSrc: string | null;
	groups: AvatarGroup[];
};

export function AvatarPicker({ initialSrc, groups }: Props) {
	const [currentSrc, setCurrentSrc] = useState(initialSrc);
	// A saved image src that 404s (stale — e.g. pointing at a file since
	// deleted/renamed out from under it) would otherwise render as a plain
	// broken <img> with nothing visible, since alt is empty — this falls
	// back to the same placeholder a null src gets instead. Reset whenever
	// currentSrc itself changes, so switching to a different (working) image
	// doesn't stay stuck on a previous failure.
	const [imageFailed, setImageFailed] = useState(false);
	const [savingSrc, setSavingSrc] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);

	useOutsideClick(panelRef, () => setIsOpen(false), {
		enabled: isOpen,
		escapeToo: true,
	});

	async function handlePick(src: string) {
		if (src === currentSrc || savingSrc) return;
		setSavingSrc(src);
		try {
			await updateAvatar(src);
			setCurrentSrc(src);
			setImageFailed(false);
			setIsOpen(false);
		} finally {
			setSavingSrc(null);
		}
	}

	return (
		<div className={styles.wrapper}>
			{/* Same no-photo stand-in as PersonPhoto (person-photo.tsx) uses for
			cast/crew — this account has no picture yet, so the same "here's
			where a photo would go" signal applies. */}
			<Clickable
				className={styles.current}
				aria-label="Change profile picture"
				onClick={() => setIsOpen(true)}>
				{currentSrc && !imageFailed ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={currentSrc}
						alt=""
						className={styles.current_image}
						onError={() => setImageFailed(true)}
					/>
				) : (
					<div className={styles.current_placeholder}>
						<UserRound size={36} />
					</div>
				)}
			</Clickable>

			{isOpen && (
				<div className={styles.modal_backdrop}>
					<div className={styles.modal_panel} ref={panelRef}>
						<div className={styles.modal_header}>
							<span>Choose a profile picture</span>
							<Clickable
								className={styles.close_button}
								aria-label="Close"
								onClick={() => setIsOpen(false)}>
								<X size={16} />
							</Clickable>
						</div>
						<div className={styles.groups}>
							{groups.map((group) => (
								<div key={group.prefix} className={styles.group}>
									<span className={styles.group_label}>
										{group.prefix.toUpperCase()}
									</span>
									<div className={styles.options}>
										{group.options.map((option) => (
											<Clickable
												key={option.id}
												className={`${styles.option} ${option.src === currentSrc ? styles.option_selected : ""}`}
												disabled={savingSrc !== null}
												aria-label="Use this profile picture"
												aria-pressed={option.src === currentSrc}
												onClick={() => handlePick(option.src)}>
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src={option.src}
													alt=""
													className={styles.option_image}
												/>
											</Clickable>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
