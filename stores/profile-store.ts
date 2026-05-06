import { create } from 'zustand';

type Profile = {
	id: string;
	email: string;
	full_name: string | null;
	avatar_url: string | null;
};

type ProfileStore = {
	profile: Profile | null;
	isLoaded: boolean;
	setProfile: (profile: Profile) => void;
	reset: () => void;
};

export const useProfileStore = create<ProfileStore>((set) => ({
	profile: null,
	isLoaded: false,

	setProfile: (profile) => set({ profile, isLoaded: true }),

	reset: () => set({ profile: null, isLoaded: false }),
}));
