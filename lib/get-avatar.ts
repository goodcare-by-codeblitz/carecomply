export function getAvatar({
	avatar_url,
	name,
}: {
	avatar_url?: string | null;
	email?: string;
	name?: string;
}) {
	// 1. User uploaded image (highest priority)
	if (avatar_url) {
		return avatar_url;
	}

	// 3. Dicebear fallback
	if (name) {
		return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
			name,
		)}`;
	}

	// 4. Default
	return '/default-avatar.png';
}
