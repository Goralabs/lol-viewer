import React from 'react';
import './Pill.css';

export type PillVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'blue-team'
  | 'red-team'
  | 'live'
  | 'neutral';

export type PillSize = 'sm' | 'md' | 'lg';

export interface PillProps {
  /**
   * Visual variant of the pill
   * - default: Neutral gray pill
   * - primary: Blue accent
   * - success: Green for positive states
   * - warning: Yellow/orange for warnings
   * - danger: Red for errors or critical states
   * - info: Light blue for information
   * - blue-team: Blue team color (LoL specific)
   * - red-team: Red team color (LoL specific)
   * - live: Animated live indicator
   * - neutral: Muted appearance
   */
  variant?: PillVariant;

  /**
   * Size of the pill
   */
  size?: PillSize;

  /**
   * Whether the pill is outlined (transparent background)
   */
  outlined?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Click handler for interactive pills
   */
  onClick?: () => void;

  /**
   * Icon to display before the label
   */
  icon?: React.ReactNode;

  /**
   * Pill content
   */
  children: React.ReactNode;

  /**
   * Test ID for testing
   */
  'data-testid'?: string;
}

const Pill: React.FC<PillProps> = ({
  variant = 'default',
  size = 'md',
  outlined = false,
  className = '',
  onClick,
  icon,
  children,
  'data-testid': testId,
}) => {
  const classNames = [
    'pill',
    `pill--${variant}`,
    `pill--${size}`,
    outlined ? 'pill--outlined' : '',
    onClick ? 'pill--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classNames}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      data-testid={testId}
    >
      {icon && <span className="pill__icon">{icon}</span>}
      <span className="pill__label">{children}</span>
    </span>
  );
};

export default Pill;
