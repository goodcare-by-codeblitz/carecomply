import { createClient } from '@/lib/supabase/client';
import { useProfileStore } from '@/stores/profile-store';

export async function initProfile() {
	const supabase = createClient();
	const { setProfile } = useProfileStore.getState();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return;

	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.maybeSingle();

	if (error) {
		console.error('Error fetching profile:', error);
		return;
	}

	if (data) {
		setProfile(data);
	}
}
