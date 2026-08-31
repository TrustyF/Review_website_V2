"use client";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getMyAvatar } from "@/components/account/account-actions";

type AvatarContextValue = {
	avatarSrc: string | null;
	setAvatarSrc: (src: string) => void;
};

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

// Lets Navbar and AvatarPicker share the current avatar without relying on
// the JWT (only refreshes at sign-in) or making RootLayout dynamic to read it
// server-side. AvatarPicker updates this directly after a pick.
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
