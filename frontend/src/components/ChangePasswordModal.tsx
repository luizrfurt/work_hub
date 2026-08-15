import { type FormEvent, useState } from 'react'

import { changePassword } from '../api/auth'
import { updateUser } from '../api/users'
import { getErrorMessage } from '../utils/format'
import { PasswordField } from './PasswordField'

interface ChangePasswordModalProps {
  onClose: () => void
  onChanged: () => Promise<void>
  userId?: number
  currentUsername?: string
  canEditUsername?: boolean
}

export function ChangePasswordModal({
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="card modal-card"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <h2>{canEditUsername ? 'Minha conta' : 'Alterar senha'}</h2>
        <p className="muted">
          {canEditUsername
            ? 'Altere seu usuário de login e/ou a senha. Depois de salvar, entre de novo.'
            : 'Depois de salvar, você entra de novo com a senha nova.'}
        </p>
        {error && <div className="alert">{error}</div>}
        {canEditUsername && (
          <label>
            Usuário de login
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              required
            />
          </label>
        )}
        <label>
          Senha atual{canEditUsername ? ' (se for mudar a senha)' : ''}
          <PasswordField
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required={!canEditUsername}
          />
        </label>
        <label>
          Nova senha{canEditUsername ? ' (opcional)' : ''}
          <PasswordField
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required={!canEditUsername}
          />
        </label>
        <label>
          Confirmar nova senha
          <PasswordField
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required={!canEditUsername}
          />
        </label>
        <div className="inline-form">
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="button ghost" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
