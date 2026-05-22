'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type DocumentType = {
	id: string;
	name: string;
};

type DocumentUploaderProps = {
	carerId: string;
	documentTypes: DocumentType[];
};

export function DocumentUploader({
	carerId,
	documentTypes,
}: DocumentUploaderProps) {
	const [documentTypeId, setDocumentTypeId] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [expiryDate, setExpiryDate] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!documentTypeId || !file) {
			toast.error('Choose a document type and file');
			return;
		}

		setIsSaving(true);

		try {
			const body = new FormData();
			body.set('carerId', carerId);
			body.set('documentTypeId', documentTypeId);
			if (expiryDate) body.set('expiryDate', expiryDate);
			body.set('file', file);

			const response = await fetch('/api/documents/upload', {
				method: 'POST',
				body,
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
			};

			if (!response.ok) {
				throw new Error(payload.error || 'Document could not be uploaded');
			}

			toast.success('Document uploaded');
			setDocumentTypeId('');
			setFile(null);
			setExpiryDate('');
		} catch (error) {
			console.error(error);
			toast.error('Failed to record document');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className='space-y-4'>
			<div className='space-y-2'>
				<Label>Document type</Label>
				<Select value={documentTypeId} onValueChange={setDocumentTypeId}>
					<SelectTrigger>
						<SelectValue placeholder='Select type' />
					</SelectTrigger>
					<SelectContent>
						{documentTypes.map((type) => (
							<SelectItem key={type.id} value={type.id}>
								{type.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='document-file'>File</Label>
				<Input
					id='document-file'
					type='file'
					onChange={(event) => setFile(event.target.files?.[0] ?? null)}
				/>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='expiry-date'>Expiry date</Label>
				<Input
					id='expiry-date'
					type='date'
					value={expiryDate}
					onChange={(event) => setExpiryDate(event.target.value)}
				/>
			</div>
			<Button type='submit' className='w-full' disabled={isSaving}>
				<Upload className='mr-2 h-4 w-4' />
				{isSaving ? 'Saving...' : 'Record document'}
			</Button>
		</form>
	);
}
