/**
 * SYNK-IA Animated Components
 * Framer Motion wrappers for consistent animations across the app
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Page transition wrapper
export const PageTransition = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ 
      duration: 0.3, 
      ease: [0.25, 0.46, 0.45, 0.94] 
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Fade in animation
export const FadeIn = ({ children, delay = 0, duration = 0.3, className = '' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ delay, duration }}
    className={className}
  >
    {children}
  </motion.div>
);

// Slide up animation
export const SlideUp = ({ children, delay = 0, duration = 0.3, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 30 }}
    transition={{ 
      delay, 
      duration,
      ease: [0.25, 0.46, 0.45, 0.94]
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Slide from side animation
export const SlideFromSide = ({ children, direction = 'left', delay = 0, className = '' }) => {
  const xOffset = direction === 'left' ? -30 : 30;
  return (
    <motion.div
      initial={{ opacity: 0, x: xOffset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: xOffset }}
      transition={{ delay, duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Scale animation for cards/buttons
export const ScaleIn = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ 
      delay, 
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94]
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Hover scale effect for interactive elements
export const HoverScale = ({ children, scale = 1.02, className = '' }) => (
  <motion.div
    whileHover={{ scale }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.2 }}
    className={className}
  >
    {children}
  </motion.div>
);

// Button with hover animation
export const AnimatedButton = ({ children, onClick, className = '', disabled = false, ...props }) => (
  <motion.button
    whileHover={disabled ? {} : { scale: 1.02, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
    whileTap={disabled ? {} : { scale: 0.98 }}
    transition={{ duration: 0.15 }}
    onClick={onClick}
    disabled={disabled}
    className={className}
    {...props}
  >
    {children}
  </motion.button>
);

// Card with hover effect
export const AnimatedCard = ({ children, className = '', onClick }) => (
  <motion.div
    whileHover={{ 
      y: -4, 
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      transition: { duration: 0.2 }
    }}
    className={className}
    onClick={onClick}
  >
    {children}
  </motion.div>
);

// Modal animation wrapper
export const ModalAnimation = ({ children, isOpen }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ 
            duration: 0.25,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// Staggered list animation
export const StaggeredList = ({ children, staggerDelay = 0.05, className = '' }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={{
      visible: {
        transition: {
          staggerChildren: staggerDelay
        }
      }
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggeredItem = ({ children, className = '' }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    }}
    transition={{ duration: 0.3 }}
    className={className}
  >
    {children}
  </motion.div>
);

// Notification/Toast animation
export const NotificationAnimation = ({ children, isVisible }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, y: -20, x: 20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, y: -20, x: 20 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

// Loading spinner animation
export const SpinnerAnimation = ({ size = 24, className = '' }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    className={className}
    style={{ width: size, height: size }}
  >
    <svg
      className="w-full h-full text-current"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  </motion.div>
);

// Pulse animation for notifications/badges
export const PulseAnimation = ({ children, className = '' }) => (
  <motion.div
    animate={{ 
      scale: [1, 1.05, 1],
      opacity: [1, 0.8, 1]
    }}
    transition={{ 
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Progress bar animation
export const AnimatedProgress = ({ progress, className = '' }) => (
  <div className={`bg-gray-700 rounded-full overflow-hidden ${className}`}>
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
    />
  </div>
);

// Counter animation for numbers
export const AnimatedNumber = ({ value, duration = 1, className = '' }) => {
  const [displayValue, setDisplayValue] = React.useState(0);
  
  React.useEffect(() => {
    const start = displayValue;
    const end = value;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      setDisplayValue(Math.floor(start + (end - start) * progress));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <span className={className}>{displayValue.toLocaleString()}</span>;
};

export default {
  PageTransition,
  FadeIn,
  SlideUp,
  SlideFromSide,
  ScaleIn,
  HoverScale,
  AnimatedButton,
  AnimatedCard,
  ModalAnimation,
  StaggeredList,
  StaggeredItem,
  NotificationAnimation,
  SpinnerAnimation,
  PulseAnimation,
  AnimatedProgress,
  AnimatedNumber
};
