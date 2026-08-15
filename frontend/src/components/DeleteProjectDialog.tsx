import { useState } from 'react'

import { deleteProject } from '../api/projects'
import type { Project } from '../types'
import { getErrorMessage } from '../utils/format'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: DeleteProjectDialogProps) {
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!project) {
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteProject(project.id)
      onDeleted()
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir o projeto.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError('')
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent showCloseButton={false} className="gap-3">
        <DialogHeader>
          <DialogTitle className="text-[1.05rem] font-semibold">Excluir projeto</DialogTitle>
          <DialogDescription>
            {project
              ? `Excluir “${project.name}”? Conversas, anexos e tarefas deste projeto também serão apagados.`
              : 'Este projeto será excluído.'}
          </DialogDescription>
        </DialogHeader>
        {error && <ErrorAlert>{error}</ErrorAlert>}
        <DialogFooter className="mx-0 mb-0 flex-row justify-start gap-2.5 rounded-none border-0 bg-transparent p-0">
          <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? 'Excluindo...' : 'Excluir projeto'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
