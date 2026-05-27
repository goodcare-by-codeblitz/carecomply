'use client';

import * as React from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  initialDelay = 0,
}: StaggerContainerProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={
        shouldReduce
          ? {}
          : {
              hidden: {},
              visible: {
                transition: {
                  delayChildren: initialDelay,
                  staggerChildren: staggerDelay,
                },
              },
            }
      }>
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  y?: number;
}

export function StaggerItem({ children, className, y = 16 }: StaggerItemProps) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className={cn(className)}
      variants={
        shouldReduce
          ? {}
          : {
              hidden: { opacity: 0, y },
              visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] } },
            }
      }>
      {children}
    </motion.div>
  );
}
