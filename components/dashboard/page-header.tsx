import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface PageHeaderProps {
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}

/**
 * Shared page header used across all dashboard pages.
 * White bg, border-b, consistent spacing.
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
	return (
		<div className={cn('border-b border-line bg-white px-6 py-5 lg:px-8', className)}>
			<div className='mx-auto flex max-w-7xl items-center justify-between gap-4'>
				<div>
					<h1 className='text-[22px] font-semibold tracking-tight text-ink'>
						{title}
					</h1>
					{description && (
						<p className='mt-0.5 text-[13px] text-slate-500'>{description}</p>
					)}
				</div>
				{action && <div className='shrink-0'>{action}</div>}
			</div>
		</div>
	);
}

export function PageContent({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('mx-auto max-w-7xl px-6 py-6 lg:px-8', className)}>
			{children}
		</div>
	);
}
