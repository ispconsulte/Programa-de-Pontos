interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export default function Spinner({ size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-[3px]',
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-white/[0.08] border-t-primary animate-spin`}
    />
  )
}
