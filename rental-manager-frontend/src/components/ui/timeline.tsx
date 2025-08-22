import React from 'react';
import { cn } from '@/lib/utils';

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

interface TimelineItemProps {
  children: React.ReactNode;
  className?: string;
}

interface TimelinePointProps {
  children: React.ReactNode;
  className?: string;
}

interface TimelineIconProps {
  children: React.ReactNode;
  className?: string;
}

interface TimelineContentProps {
  children: React.ReactNode;
  className?: string;
}

interface TimelineTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface TimelineDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative', className)}
      {...props}
    >
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      {children}
    </div>
  )
);
Timeline.displayName = 'Timeline';

export const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative flex gap-4 pb-6 last:pb-0', className)}
      {...props}
    >
      {children}
    </div>
  )
);
TimelineItem.displayName = 'TimelineItem';

export const TimelinePoint = React.forwardRef<HTMLDivElement, TimelinePointProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative z-10', className)}
      {...props}
    >
      {children}
    </div>
  )
);
TimelinePoint.displayName = 'TimelinePoint';

export const TimelineIcon = React.forwardRef<HTMLDivElement, TimelineIconProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
TimelineIcon.displayName = 'TimelineIcon';

export const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex-1 space-y-1', className)}
      {...props}
    >
      {children}
    </div>
  )
);
TimelineContent.displayName = 'TimelineContent';

export const TimelineTitle = React.forwardRef<HTMLHeadingElement, TimelineTitleProps>(
  ({ children, className, ...props }, ref) => (
    <h4
      ref={ref}
      className={cn('text-sm font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h4>
  )
);
TimelineTitle.displayName = 'TimelineTitle';

export const TimelineDescription = React.forwardRef<HTMLParagraphElement, TimelineDescriptionProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    >
      {children}
    </div>
  )
);
TimelineDescription.displayName = 'TimelineDescription';