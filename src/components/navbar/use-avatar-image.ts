"use client";
import { useState } from "react";

// Reset via derive-from-prop when stale avatar 404s, not effect.
export function useAvatarImage(avatarSrc: string | null) {
	const [avatarFailed, setAvatarFailed] = useState(false);
	const [lastAvatarSrc, setLastAvatarSrc] = useState(avatarSrc);
	if (avatarSrc !== lastAvatarSrc) {
		setLastAvatarSrc(avatarSrc);
		setAvatarFailed(false);
	}

	return {
		showAvatar: Boolean(avatarSrc) && !avatarFailed,
		onAvatarError: () => setAvatarFailed(true),
	};
}
