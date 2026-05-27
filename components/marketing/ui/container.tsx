import * as React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mx-auto max-w-7xl px-6 lg:px-8', className)}
      {...props}>
      {children}
    </div>
  )
);
Container.displayName = 'Container';
