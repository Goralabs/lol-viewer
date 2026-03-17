import React from 'react';
import './Card.css';

export interface CardProps {
  /**
   * Visual variant of the card
   * - default: Standard card with subtle shadow
   * - elevated: More prominent shadow for emphasis
   * - interactive: Hover effects for clickable cards
   */
  variant?: 'default' | 'elevated' | 'interactive';

  /**
   * Internal padding size
   */
  padding?: 'none' | 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Click handler (automatically enables interactive styles)
   */
  onClick?: () => void;

  /**
   * Card content
   */
  children: React.ReactNode;

  /**
   * HTML element to render as
   */
  as?: keyof JSX.IntrinsicElements;

  /**
   * ARIA label for interactive cards
   */
  'aria-label'?: string;

  /**
   * Test ID for testing
   */
  'data-testid'?: string;
}

const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  onClick,
  children,
  as: Component = 'div',
  'aria-label': ariaLabel,
  'data-testid': testId,
}) => {
  const classNames = [
    'card',
    `card--${variant}`,
    `card--padding-${padding}`,
    onClick ? 'card--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Component
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
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </Component>
  );
};

export default Card;
