import { cn } from '@/lib/utils'

export function BrandLogo({
  className,
  size = 36,
}: {
  className?: string
  size?: number
}) {
  return (
    <img
      src="/workhub.png"
      alt="WorkHub"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-[10px] object-cover', className)}
    />
  )
}
