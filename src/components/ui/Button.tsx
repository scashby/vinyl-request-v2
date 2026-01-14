import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost" | "gradient";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", fullWidth = false, children, ...props }, ref) => {
    
    // Base styles applied to all buttons (Flexbox, transition, focus states)
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    
    // Width styles
    const widthStyles = fullWidth ? "w-full" : "";

    // Size variants
    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    // Color/Theme variants (Consolidated from your various CSS files)
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500", // Replaces .back-button, .btn.primary
      secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 border border-gray-300", // Replaces .button-secondary
      danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500", // Replaces .remove-button, .btn.danger
      success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500", // Replaces .btn.success
      ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900", // For nav links/icons
      gradient: "bg-gradient-to-br from-blue-500 to-blue-700 text-white hover:shadow-lg transform hover:-translate-y-0.5", // Replaces .queue-plus-btn
    };

    const combinedClassName = `${baseStyles} ${sizes[size]} ${variants[variant]} ${widthStyles} ${className}`;

    return (
      <button ref={ref} className={combinedClassName} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";