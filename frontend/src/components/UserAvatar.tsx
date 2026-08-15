import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function UserAvatar({
  label,
  size = 'default',
}: {
  label: string
  size?: 'default' | 'sm'
}) {
  return (
    <Avatar
      size={size}
      className={cn(
        'border border-[rgba(110,168,255,0.28)] after:hidden',
        size === 'default' && 'size-9',
        size === 'sm' && 'size-7',
      )}
    >
      <AvatarFallback className="bg-[rgba(110,168,255,0.22)] font-bold text-foreground group-data-[size=sm]/avatar:text-[0.7rem]">
        {label}
      </AvatarFallback>
    </Avatar>
  )
}
