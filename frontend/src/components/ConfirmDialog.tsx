import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-3">
        <DialogHeader>
          <DialogTitle className="text-[1.05rem] font-semibold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 flex-row justify-start gap-2.5 rounded-none border-0 bg-transparent p-0">
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
