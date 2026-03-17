import React from 'react';
import './Skeleton.css';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonProps {
  /**
   * Visual variant of the skeleton
   * - text: Single line of text (default height: 1em)
   * - circular: Circular shape (for avatars, icons)
   * - rectangular: Generic rectangle (for images, cards)
   */
  variant?: SkeletonVariant;

  /**
   * Width of the skeleton
   * Can be a number (pixels) or string (CSS value)
   */
  width?: string | number;

  /**
   * Height of the skeleton
   * Can be a number (pixels) or string (CSS value)
   */
  height?: string | number;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Animation style
   * - shimmer: Gradient shimmer effect (default)
   * - pulse: Simple opacity pulse
   * - none: No animation
   */
  animation?: 'shimmer' | 'pulse' | 'none';

  /**
   * Border radius override
   */
  borderRadius?: string | number;

  /**
   * Test ID for testing
   */
  'data-testid'?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'shimmer',
  borderRadius,
  'data-testid': testId,
}) => {
  // Convert number values to pixel strings
  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;
  const borderRadiusStyle = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  const classNames = [
    'skeleton',
    `skeleton--${variant}`,
    animation !== 'none' ? `skeleton--${animation}` : '',
    className,
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = {
    width: widthStyle,
    height: heightStyle,
    borderRadius: borderRadiusStyle,
  };

  return (
    <span
      className={classNames}
      style={style}
      aria-hidden="true"
      data-testid={testId}
    />
  );
};

/* ===========================================
 * COMPOUND COMPONENTS FOR COMMON PATTERNS
 * =========================================== */

/**
 * Skeleton for a single line of text
 */
export const SkeletonText: React.FC<{
  lines?: number;
  width?: string | number;
  className?: string;
}> = ({ lines = 1, width = '100%', className = '' }) => {
  if (lines === 1) {
    return <Skeleton variant="text" width={width} className={className} />;
  }

  return (
    <div className={`skeleton-text-group ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? '75%' : width}
          className="skeleton-text-group__line"
        />
      ))}
    </div>
  );
};

/**
 * Skeleton for an avatar
 */
export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: '24px',
    md: '40px',
    lg: '56px',
  };

  const sizeValue = typeof size === 'number' ? `${size}px` : sizeMap[size];

  return (
    <Skeleton
      variant="circular"
      width={sizeValue}
      height={sizeValue}
      className={className}
    />
  );
};

/**
 * Skeleton for an image placeholder
 */
export const SkeletonImage: React.FC<{
  width?: string | number;
  height?: string | number;
  className?: string;
}> = ({ width = '100%', height = '200px', className = '' }) => {
  return (
    <Skeleton
      variant="rectangular"
      width={width}
      height={height}
      className={className}
    />
  );
};

/**
 * Skeleton for a card with header, content, and actions
 */
export const SkeletonCard: React.FC<{
  hasAvatar?: boolean;
  lines?: number;
  hasAction?: boolean;
  className?: string;
}> = ({ hasAvatar = true, lines = 3, hasAction = true, className = '' }) => {
  return (
    <div className={`skeleton-card ${className}`}>
      <div className="skeleton-card__header">
        {hasAvatar && <SkeletonAvatar size="md" />}
        <div className="skeleton-card__header-text">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height="12px" />
        </div>
      </div>
      <div className="skeleton-card__content">
        <SkeletonText lines={lines} />
      </div>
      {hasAction && (
        <div className="skeleton-card__actions">
          <Skeleton variant="rectangular" width="80px" height="32px" borderRadius="4px" />
        </div>
      )}
    </div>
  );
};

export default Skeleton;
