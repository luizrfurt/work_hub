import { type FormEvent, useEffect, useState } from 'react'

import { createUser, listUsers, updateUser } from '../../api/users'
import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../contexts/AuthContext'
import type { User, UserRole } from '../../types'
import { getErrorMessage, roleLabel } from '../../utils/format'

export function UsersPage() {
  const { user: currentUser, logout, applyUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('COLLABORATOR')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('COLLABORATOR')
  const [editActive, setEditActive] = useState(true)

  async function loadUsers() {
    try {
      setUsers(await listUsers())
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar os usuários.'))
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  function startEdit(user: User) {
    setEditing(user)
    setEditName(user.name)
    setEditUsername(user.username)
    setEditPassword('')
    setEditRole(user.role)
    setEditActive(user.is_active)
    setError('')
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createUser({ name, username, password, role })
      setName('')
      setUsername('')
      setPassword('')
      setRole('COLLABORATOR')
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível cadastrar o usuário.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault()
    if (!editing) {
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateUser(editing.id, {
        name: editName,
        username: editUsername,
        role: editRole,
        is_active: editActive,
        password: editPassword || undefined,
      })
      const editingSelf = editing.id === currentUser?.id
      const changedOwnLogin =
        editingSelf &&
        (Boolean(editPassword) || editUsername.trim() !== (currentUser?.username ?? ''))
      setEditing(null)
      setEditPassword('')
      if (changedOwnLogin) {
        await logout()
        return
      }
      if (editingSelf) {
        applyUser(updated)
      }
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível atualizar o usuário.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Usuários</h1>
          <p className="muted">
            Cadastre pessoas da empresa e altere nome, usuário de login, senha, perfil e situação.
          </p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <form className="card form-card" onSubmit={(event) => void handleCreate(event)}>
        <h2>Novo usuário</h2>
        <div className="form-row">
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Usuário de login
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Senha
            <PasswordField
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>
            Perfil
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="COLLABORATOR">Colaborador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
        </div>
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Cadastrar usuário'}
        </button>
      </form>

      {editing && (
        <form className="card form-card" onSubmit={(event) => void handleUpdate(event)}>
          <h2>Editar {editing.name}</h2>
          <div className="form-row">
            <label>
              Nome
              <input value={editName} onChange={(event) => setEditName(event.target.value)} required />
            </label>
            <label>
              Usuário de login
              <input
                value={editUsername}
                onChange={(event) => setEditUsername(event.target.value)}
                minLength={3}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Nova senha (opcional)
              <PasswordField
                value={editPassword}
                onChange={(event) => setEditPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              Perfil
              <select value={editRole} onChange={(event) => setEditRole(event.target.value as UserRole)}>
                <option value="COLLABORATOR">Colaborador</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <label>
              Situação
              <select
                value={editActive ? 'active' : 'inactive'}
                onChange={(event) => setEditActive(event.target.value === 'active')}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>
          <div className="inline-form">
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button className="button ghost" type="button" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuário de login</th>
              <th>Perfil</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.username}</td>
                <td>{roleLabel(item.role)}</td>
                <td>
                  <span className={`status-pill ${item.is_active ? 'on' : 'off'}`}>
                    {item.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <button className="button ghost small" type="button" onClick={() => startEdit(item)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
