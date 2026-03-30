interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export default function Spinner({ size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-[1.5px]',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-2',
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-[hsl(var(--border))] border-t-primary animate-spin`}
    />
  )
}
