import { type FormEvent, useEffect, useState } from 'react'

import { updateProject } from '../api/projects'
import type { Project } from '../types'
import { getErrorMessage } from '../utils/format'
import { ErrorAlert } from './ErrorAlert'
import { Field } from './Field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface EditProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (project: Project) => void
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: EditProjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !project) {
      return
    }
    setName(project.name)
    setDescription(project.description ?? '')
    setError('')
  }, [open, project])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!project) {
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateProject(project.id, {
        name,
        description,
      })
      onSaved(updated)
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar o projeto.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-3">
        <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle className="text-[1.05rem] font-semibold">Editar projeto</DialogTitle>
            <DialogDescription>Altere o nome e a descrição deste projeto.</DialogDescription>
          </DialogHeader>
          {error && <ErrorAlert>{error}</ErrorAlert>}
          <Field label="Nome">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </Field>
          <DialogFooter className="mx-0 mb-0 flex-row justify-start gap-2.5 rounded-none border-0 bg-transparent p-0">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
