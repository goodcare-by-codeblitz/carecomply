'use client';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const ThemeSwitcher = () => {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();

	// useEffect only runs on the client, so now we can safely show the UI
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	const ICON_CLASS = 'size-4 text-muted-foreground';

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' size={'sm'}>
					{theme === 'light' ? (
						<Sun key='light' className={ICON_CLASS} />
					) : theme === 'dark' ? (
						<Moon key='dark' className={ICON_CLASS} />
					) : (
						<Laptop key='system' className={ICON_CLASS} />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className='w-content' align='start'>
				<DropdownMenuRadioGroup
					value={theme}
					onValueChange={(e) => setTheme(e)}>
					<DropdownMenuRadioItem className='flex gap-2' value='light'>
						<Sun className={ICON_CLASS} />
						<span>Light</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem className='flex gap-2' value='dark'>
						<Moon className={ICON_CLASS} />
						<span>Dark</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem className='flex gap-2' value='system'>
						<Laptop className={ICON_CLASS} />
						<span>System</span>
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { ThemeSwitcher };
