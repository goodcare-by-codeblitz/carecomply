'use client';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Clock, RotateCcw, ShieldAlert, UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type CarerStatusActionsProps = {
	carerId: string;
	status: string | null;
};

type StatusAction =
	| 'mark_on_leave'
	| 'return_from_leave'
	| 'mark_suspended'
	| 'return_from_suspension'
	| 'mark_former'
	| 'restore_former';

export function CarerStatusActions({ carerId, status }: CarerStatusActionsProps) {
	const router = useRouter();
	const [isUpdating, setIsUpdating] = useState(false);

	const updateStatus = async (action: StatusAction) => {
		setIsUpdating(true);
		try {
			const response = await fetch('/api/carers/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ carerId, action }),
			});
			const payload = (await response.json()) as { error?: string };

			if (!response.ok) {
				toast.error(payload.error ?? 'Carer status could not be updated');
				return;
			}

			toast.success('Carer status updated');
			router.refresh();
		} catch {
			toast.error('Carer status could not be updated');
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<div className='flex flex-wrap items-center gap-2'>
			{status === 'former' ? (
				<Button
					type='button'
					variant='outline'
					size='sm'
					disabled={isUpdating}
					onClick={() => updateStatus('restore_former')}>
					<RotateCcw className='mr-2 h-4 w-4' />
					Restore carer
				</Button>
			) : status === 'on_leave' ? (
				<Button
					type='button'
					variant='outline'
					size='sm'
					disabled={isUpdating}
					onClick={() => updateStatus('return_from_leave')}>
					<RotateCcw className='mr-2 h-4 w-4' />
					Return from leave
				</Button>
			) : status !== 'suspended' ? (
				<Button
					type='button'
					variant='outline'
					size='sm'
					disabled={isUpdating}
					onClick={() => updateStatus('mark_on_leave')}>
					<Clock className='mr-2 h-4 w-4' />
					Mark on leave
				</Button>
			) : null}
			{status === 'suspended' ? (
				<Button
					type='button'
					variant='outline'
					size='sm'
					disabled={isUpdating}
					onClick={() => updateStatus('return_from_suspension')}>
					<RotateCcw className='mr-2 h-4 w-4' />
					Return from suspension
				</Button>
			) : status !== 'former' ? (
				<Button
					type='button'
					variant='outline'
					size='sm'
					disabled={isUpdating}
					onClick={() => updateStatus('mark_suspended')}>
					<ShieldAlert className='mr-2 h-4 w-4' />
					Suspend
				</Button>
			) : null}
			{status !== 'former' && (
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							type='button'
							variant='outline'
							size='sm'
							disabled={isUpdating}>
							<UserMinus className='mr-2 h-4 w-4' />
							Move to former
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Move to Former Employees?</AlertDialogTitle>
							<AlertDialogDescription>
								This removes the carer from current employees, but keeps their
								documents, references, invitations, and review history.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant='destructive'
								onClick={() => updateStatus('mark_former')}>
								Move to former
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	);
}
