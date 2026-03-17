import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Tooltip.css';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /**
   * Content to display in the tooltip
   */
  content: React.ReactNode;

  /**
   * Position of the tooltip relative to the trigger
   */
  position?: TooltipPosition;

  /**
   * Delay before showing the tooltip (in ms)
   */
  showDelay?: number;

  /**
   * Delay before hiding the tooltip (in ms)
   */
  hideDelay?: number;

  /**
   * Whether the tooltip is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes for the tooltip
   */
  className?: string;

  /**
   * Additional CSS classes for the trigger wrapper
   */
  triggerClassName?: string;

  /**
   * Element that triggers the tooltip
   */
  children: React.ReactNode;

  /**
   * Test ID for testing
   */
  'data-testid'?: string;
}

interface TooltipState {
  visible: boolean;
  coords: { top: number; left: number };
  actualPosition: TooltipPosition;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  showDelay = 200,
  hideDelay = 100,
  disabled = false,
  className = '',
  triggerClassName = '',
  children,
  'data-testid': testId,
}) => {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    coords: { top: 0, left: 0 },
    actualPosition: position,
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  const calculatePosition = useCallback((): { top: number; left: number; actualPosition: TooltipPosition } => {
    if (!triggerRef.current || !tooltipRef.current) {
      return { top: 0, left: 0, actualPosition: position };
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spacing = 8; // Gap between trigger and tooltip
    let top = 0;
    let left = 0;
    let actualPosition = position;

    // Calculate initial position
    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + spacing;
        break;
    }

    // Adjust if tooltip goes outside viewport
    if (position === 'top' && top < 0) {
      actualPosition = 'bottom';
      top = triggerRect.bottom + spacing;
    } else if (position === 'bottom' && top + tooltipRect.height > viewportHeight) {
      actualPosition = 'top';
      top = triggerRect.top - tooltipRect.height - spacing;
    } else if (position === 'left' && left < 0) {
      actualPosition = 'right';
      left = triggerRect.right + spacing;
    } else if (position === 'right' && left + tooltipRect.width > viewportWidth) {
      actualPosition = 'left';
      left = triggerRect.left - tooltipRect.width - spacing;
    }

    // Clamp horizontal position
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));

    // Clamp vertical position
    top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));

    // Add scroll offset
    top += window.scrollY;
    left += window.scrollX;

    return { top, left, actualPosition };
  }, [position]);

  const showTooltip = useCallback(() => {
    if (disabled) return;

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    showTimeoutRef.current = setTimeout(() => {
      // First, make tooltip visible but invisible to measure
      setState((prev) => ({ ...prev, visible: true }));

      // Use requestAnimationFrame to ensure DOM is updated before calculating
      requestAnimationFrame(() => {
        const coords = calculatePosition();
        setState((prev) => ({ ...prev, ...coords }));
      });
    }, showDelay);
  }, [disabled, showDelay, calculatePosition]);

  const hideTooltip = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }));
    }, hideDelay);
  }, [hideDelay]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Recalculate position on scroll/resize
  useEffect(() => {
    if (!state.visible) return;

    const handleScroll = () => {
      const coords = calculatePosition();
      setState((prev) => ({ ...prev, ...coords }));
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [state.visible, calculatePosition]);

  const classNames = [
    'tooltip',
    `tooltip--${state.actualPosition}`,
    state.visible ? 'tooltip--visible' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`tooltip-trigger ${triggerClassName}`}
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      data-testid={testId}
    >
      {children}
      {state.visible && (
        <div
          ref={tooltipRef}
          className={classNames}
          role="tooltip"
          aria-hidden={!state.visible}
          style={{
            position: 'absolute',
            top: state.coords.top,
            left: state.coords.left,
          }}
        >
          <div className="tooltip__content">{content}</div>
          <div className="tooltip__arrow" />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
