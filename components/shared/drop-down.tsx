import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvatar } from '@/lib/get-avatar';
import { useOrgStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import {
	BadgeCheckIcon,
	BellIcon,
	CreditCardIcon,
	LogOutIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const DropDown = ({ orgSlug }: { orgSlug?: string }) => {
	const profile = useProfileStore((state) => state.profile);
	const fullName = profile?.full_name || '';
	const router = useRouter();

	const avatarUrl = getAvatar({
		name: fullName,
	});

	const resetOrgStore = useOrgStore((state) => state.reset);
	const resetProfileStore = useProfileStore((state) => state.reset);

	async function handleLogout() {
		await fetch('/auth/logout', { method: 'POST' });
		resetOrgStore();
		resetProfileStore();
		router.push('/');
		router.refresh();
	}

	return (
		<div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant='ghost' size='icon' className='rounded-full'>
						<Avatar className='h-10 w-10'>
							<AvatarImage src={avatarUrl} alt='shadcn' />
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end' className='w-56 p-4 mt-3'>
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<BadgeCheckIcon />
							Account
						</DropdownMenuItem>
						{orgSlug && (
							<DropdownMenuItem asChild>
								<Link href={`/${orgSlug}/settings`}>
									<CreditCardIcon />
									Billing
								</Link>
							</DropdownMenuItem>
						)}
						<DropdownMenuItem>
							<BellIcon />
							Notifications
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem className='hover:bg-transparent px-0'>
						<Button
							onClick={handleLogout}
							className='w-full  justify-start'
							variant='ghost'>
							<LogOutIcon />
							Sign Out
						</Button>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};

export default DropDown;
