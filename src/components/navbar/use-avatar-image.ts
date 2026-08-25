"use client";
import { useState } from "react";

// A saved avatar src that 404s (stale — see avatar-picker.tsx's own version
// of this) would otherwise render as a blank broken <img> instead of falling
// back to AccountIcon. Reset whenever avatarSrc itself changes — the
// React-recommended "adjust state during render" pattern rather than a
// useEffect, since this is deriving state from a prop change, not
// synchronizing with an external system. Shared by the desktop and mobile
// avatar links (both render off the same avatarSrc/failed pair).
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
