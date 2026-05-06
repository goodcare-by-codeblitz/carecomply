import { Shield, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SignUpSuccessPage() {
	return (
		<div className='min-h-screen flex items-center justify-center p-8'>
			<div className='w-full max-w-md text-center'>
				<div className='flex justify-center mb-8'>
					<div className='w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center'>
						<Mail className='w-8 h-8 text-background' />
					</div>
				</div>

				<h1 className='text-2xl font-semibold tracking-tight mb-3'>
					Check your email
				</h1>
				<p className='text-muted-foreground mb-8 leading-relaxed'>
					We&apos;ve sent you a confirmation link. Please check your inbox and
					click the link to activate your account.
				</p>

				<Button asChild variant='outline' className='h-12 px-8'>
					<Link href='/login'>Back to sign in</Link>
				</Button>

				<div className='mt-12 flex items-center justify-center gap-2 text-muted-foreground'>
					<Shield className='w-4 h-4' />
					<span className='text-sm'>CareComply</span>
				</div>
			</div>
		</div>
	);
}
