"use client";
import { useState } from "react";

// A stale avatar src that 404s would render a broken <img> instead of
// falling back to AccountIcon. Reset via the "adjust state during render"
// pattern (deriving from a prop change, not an effect) whenever avatarSrc changes.
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
