import React from 'react';
import styles from './ShinyText.module.css';

export interface ShinyTextProps {
  /** The text to display with shine effect */
  text: string;
  /** Disable the animation */
  disabled?: boolean;
  /** Animation speed in seconds */
  speed?: number;
  /** Additional CSS class names */
  className?: string;
}

/**
 * ShinyText - Text component with animated shine effect
 * Uses CSS Modules for scoped styling
 */
const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 5,
  className = '',
}) => {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`${styles.shinyText} ${disabled ? styles.disabled : ''} ${className}`}
      style={{ animationDuration }}
    >
      {text}
    </div>
  );
};

export default ShinyText;
