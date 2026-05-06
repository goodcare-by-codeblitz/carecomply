import { createClient } from '@/lib/supabase/client';
import { useProfileStore } from '@/stores/profile-store';

export async function initProfile() {
	const supabase = createClient();
	const { setProfile } = useProfileStore.getState();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return;

	console.log('Authenticated user:', user);

	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.maybeSingle();

	if (error) {
		console.error('Error fetching profile:', error);
		return;
	}

	console.log('Fetched profile data:', data);

	if (data) {
		setProfile(data);
	}
}
