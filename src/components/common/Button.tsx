import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant: primary (cyan), secondary (surface), danger (red) */
  variant?: ButtonVariant
  /** Button content */
  children: ReactNode
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; bgHover: string; color: string; border: string }> = {
  primary: {
    bg: 'var(--color-primary)',
    bgHover: 'var(--color-primary-hover)',
    color: 'var(--text-inverse)',
    border: 'transparent',
  },
  secondary: {
    bg: 'var(--surface)',
    bgHover: 'var(--surface-hover)',
    color: 'var(--text-primary)',
    border: 'var(--border-default)',
  },
  danger: {
    bg: 'var(--color-danger)',
    bgHover: '#E0354F',
    color: '#FFFFFF',
    border: 'transparent',
  },
}

/**
 * Button — base button component with 3 variants.
 * - primary: cyan background, dark text — for main CTAs
 * - secondary: surface background, light text — for secondary actions
 * - danger: red background, white text — for destructive actions
 *
 * Transition limited to color and background-color at 150ms.
 */
export default function Button({
  variant = 'primary',
  children,
  disabled,
  style: externalStyle,
  ...props
}: ButtonProps) {
  const v = VARIANT_STYLES[variant]

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        backgroundColor: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 6,
        padding: '8px 16px',
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 150ms, background-color 150ms',
        ...externalStyle,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = v.bgHover
        }
        props.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = v.bg
        }
        props.onMouseLeave?.(e)
      }}
    >
      {children}
    </button>
  )
}
