import { type FormEvent, useState } from 'react'

import { changePassword } from '../api/auth'
import { updateUser } from '../api/users'
import { Field } from './Field'
import { ErrorAlert } from './ErrorAlert'
import { PasswordField } from './PasswordField'
import { getErrorMessage } from '../utils/format'
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

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
  onChanged: () => Promise<void>
  userId?: number
  currentUsername?: string
  canEditUsername?: boolean
}

export function ChangePasswordModal({
  open,
  onClose,
  onChanged,
  userId,
  currentUsername = '',
  canEditUsername = false,
}: ChangePasswordModalProps) {
  const [username, setUsername] = useState(currentUsername)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextUsername = username.trim()
    const usernameChanged = canEditUsername && nextUsername !== currentUsername.trim()
    const wantsNewPassword = Boolean(newPassword || confirmPassword)

    if (canEditUsername && !usernameChanged && !wantsNewPassword) {
      setError('Altere o usuário de login ou a senha.')
      return
    }
    if (wantsNewPassword && !currentPassword) {
      setError('Informe a senha atual.')
      return
    }
    if (wantsNewPassword && newPassword !== confirmPassword) {
      setError('A confirmação não confere com a nova senha.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (usernameChanged && userId) {
        await updateUser(userId, { username: nextUsername })
      }
      if (wantsNewPassword || !canEditUsername) {
        await changePassword(currentPassword, newPassword)
      }
      await onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar as alterações.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="gap-3">
        <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle className="text-[1.05rem] font-semibold">
              {canEditUsername ? 'Minha conta' : 'Alterar senha'}
            </DialogTitle>
            <DialogDescription>
              {canEditUsername
                ? 'Altere seu usuário de login e/ou a senha. Depois de salvar, entre de novo.'
                : 'Depois de salvar, você entra de novo com a senha nova.'}
            </DialogDescription>
          </DialogHeader>
          {error && <ErrorAlert>{error}</ErrorAlert>}
          {canEditUsername && (
            <Field label="Usuário de login">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                minLength={3}
                required
              />
            </Field>
          )}
          <Field label={`Senha atual${canEditUsername ? ' (se for mudar a senha)' : ''}`}>
            <PasswordField
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required={!canEditUsername}
            />
          </Field>
          <Field label={`Nova senha${canEditUsername ? ' (opcional)' : ''}`}>
            <PasswordField
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required={!canEditUsername}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <PasswordField
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required={!canEditUsername}
            />
          </Field>
          <DialogFooter className="mx-0 mb-0 flex-row justify-start gap-2.5 rounded-none border-0 bg-transparent p-0">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
