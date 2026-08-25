"use client";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getMyAvatar } from "@/components/account/account-actions";

type AvatarContextValue = {
	avatarSrc: string | null;
	setAvatarSrc: (src: string) => void;
};

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

// Lets Navbar (in RootLayout) and AvatarPicker (on /account, way lower in
// the tree) share the current avatar without either the JWT (which only
// refreshes at sign-in — see auth.ts's own comment) or making RootLayout
// itself dynamic just to read it server-side. Fetched once per page load
// via getMyAvatar() rather than derived from the session; AvatarPicker calls
// setAvatarSrc directly right after a successful pick instead of waiting on
// a second round trip, since it already knows the new value.
export function AvatarProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

	useEffect(() => {
		if (!session?.user?.id) return;
		let cancelled = false;
		getMyAvatar().then((src) => {
			if (!cancelled) setAvatarSrc(src);
		});
		return () => {
			cancelled = true;
		};
	}, [session?.user?.id]);

	return (
		<AvatarContext.Provider value={{ avatarSrc, setAvatarSrc }}>
			{children}
		</AvatarContext.Provider>
	);
}

export function useAvatar(): AvatarContextValue {
	const ctx = useContext(AvatarContext);
	if (!ctx) throw new Error("useAvatar must be used within AvatarProvider");
	return ctx;
}
