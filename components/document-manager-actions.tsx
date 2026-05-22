'use client';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type DocumentManagerActionsProps = {
	documentId: string;
	status: string;
	expiryDate: string | null;
	fileName: string;
	onChanged?: () => void | Promise<void>;
};

export function DocumentManagerActions({
	documentId,
	status,
	expiryDate,
	fileName,
	onChanged,
}: DocumentManagerActionsProps) {
	const router = useRouter();
	const canManage = status === 'approved';
	const [editOpen, setEditOpen] = useState(false);
	const [replaceOpen, setReplaceOpen] = useState(false);
	const [expiryValue, setExpiryValue] = useState(expiryDate ?? '');
	const [notesValue, setNotesValue] = useState('');
	const [replacementExpiry, setReplacementExpiry] = useState(expiryDate ?? '');
	const [replacementNotes, setReplacementNotes] = useState('');
	const [replacementFile, setReplacementFile] = useState<File | null>(null);
	const [saving, setSaving] = useState(false);

	if (!canManage) return null;

	const refresh = async () => {
		await onChanged?.();
		router.refresh();
	};

	const saveMetadata = async () => {
		setSaving(true);
		try {
			const response = await fetch('/api/documents/manage', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					documentId,
					expiryDate: expiryValue || null,
					reviewNotes: notesValue || null,
				}),
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
			};

			if (!response.ok) {
				throw new Error(payload.error || 'Document could not be updated');
			}

			toast.success('Document expiry updated');
			setEditOpen(false);
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Document could not be updated',
			);
		} finally {
			setSaving(false);
		}
	};

	const replaceDocument = async () => {
		if (!replacementFile) {
			toast.error('Choose a replacement file');
			return;
		}

		setSaving(true);
		try {
			const body = new FormData();
			body.set('documentId', documentId);
			body.set('file', replacementFile);
			if (replacementExpiry) body.set('expiryDate', replacementExpiry);
			if (replacementNotes) body.set('reviewNotes', replacementNotes);

			const response = await fetch('/api/documents/manage', {
				method: 'POST',
				body,
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
			};

			if (!response.ok) {
				throw new Error(payload.error || 'Document could not be replaced');
			}

			toast.success('Document replaced and history preserved');
			setReplaceOpen(false);
			setReplacementFile(null);
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Document could not be replaced',
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className='flex items-center gap-2'>
			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogTrigger asChild>
					<Button variant='ghost' size='sm'>
						<Edit className='mr-2 h-4 w-4' />
						Edit
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit approved document</DialogTitle>
						<DialogDescription>
							Update the expiry date without changing the stored file.
						</DialogDescription>
					</DialogHeader>
					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor={`expiry-${documentId}`}>Expiry date</Label>
							<Input
								id={`expiry-${documentId}`}
								type='date'
								value={expiryValue}
								onChange={(event) => setExpiryValue(event.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor={`notes-${documentId}`}>Review notes</Label>
							<Textarea
								id={`notes-${documentId}`}
								value={notesValue}
								onChange={(event) => setNotesValue(event.target.value)}
								placeholder='Optional note for the audit trail'
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setEditOpen(false)}>
							Cancel
						</Button>
						<Button onClick={saveMetadata} disabled={saving}>
							{saving ? 'Saving...' : 'Save changes'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
				<DialogTrigger asChild>
					<Button variant='outline' size='sm'>
						<RefreshCcw className='mr-2 h-4 w-4' />
						Replace
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Replace approved document</DialogTitle>
						<DialogDescription>
							The existing file, {fileName}, will remain in document history for
							audit evidence.
						</DialogDescription>
					</DialogHeader>
					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor={`replacement-file-${documentId}`}>
								Replacement file
							</Label>
							<Input
								id={`replacement-file-${documentId}`}
								type='file'
								onChange={(event) =>
									setReplacementFile(event.target.files?.[0] ?? null)
								}
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor={`replacement-expiry-${documentId}`}>
								Expiry date
							</Label>
							<Input
								id={`replacement-expiry-${documentId}`}
								type='date'
								value={replacementExpiry}
								onChange={(event) => setReplacementExpiry(event.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor={`replacement-notes-${documentId}`}>
								Review notes
							</Label>
							<Textarea
								id={`replacement-notes-${documentId}`}
								value={replacementNotes}
								onChange={(event) => setReplacementNotes(event.target.value)}
								placeholder='Optional note for the replacement audit trail'
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setReplaceOpen(false)}>
							Cancel
						</Button>
						<Button onClick={replaceDocument} disabled={saving}>
							{saving ? 'Replacing...' : 'Replace document'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
