import { Pencil } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { createUser, listUsers, updateUser } from '../../api/users'
import { ErrorAlert } from '../../components/ErrorAlert'
import { Field } from '../../components/Field'
import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../contexts/AuthContext'
import type { User, UserRole } from '../../types'
import { getErrorMessage, roleLabel } from '../../utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
      <div className="mb-[1.2rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[1.75rem] font-bold tracking-[-0.02em]">Usuários</h1>
          <p className="text-muted-foreground">
            Cadastre pessoas da empresa e altere nome, usuário de login, senha, perfil e situação.
          </p>
        </div>
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Card className="mb-4">
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void handleCreate(event)}>
            <h2 className="text-[1.05rem] font-semibold">Novo usuário</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[0.85rem]">
              <Field label="Nome">
                <Input value={name} onChange={(event) => setName(event.target.value)} required />
              </Field>
              <Field label="Usuário de login">
                <Input value={username} onChange={(event) => setUsername(event.target.value)} required />
              </Field>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[0.85rem]">
              <Field label="Senha">
                <PasswordField
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </Field>
              <Field label="Perfil">
                <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="COLLABORATOR">Colaborador</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button className="w-fit" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : '+ Novo usuário'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {editing && (
        <Card className="mb-4">
          <CardContent>
            <form className="grid gap-3" onSubmit={(event) => void handleUpdate(event)}>
              <h2 className="text-[1.05rem] font-semibold">Editar {editing.name}</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[0.85rem]">
                <Field label="Nome">
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} required />
                </Field>
                <Field label="Usuário de login">
                  <Input
                    value={editUsername}
                    onChange={(event) => setEditUsername(event.target.value)}
                    minLength={3}
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[0.85rem]">
                <Field label="Nova senha (opcional)">
                  <PasswordField
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Perfil">
                  <Select value={editRole} onValueChange={(value) => setEditRole(value as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="COLLABORATOR">Colaborador</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Situação">
                  <Select
                    value={editActive ? 'active' : 'inactive'}
                    onValueChange={(value) => setEditActive(value === 'active')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex gap-[0.6rem] max-[800px]:grid max-[800px]:grid-cols-1">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Usuário de login</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.username}</TableCell>
                  <TableCell>{roleLabel(item.role)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        item.is_active
                          ? 'rounded-full border-[rgba(109,255,176,0.35)] bg-[rgba(109,255,176,0.12)] px-[0.62rem] py-[0.18rem] text-ok'
                          : 'rounded-full border-border bg-white/4 px-[0.62rem] py-[0.18rem] text-muted-foreground'
                      }
                    >
                      {item.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      title="Editar"
                      aria-label={`Editar ${item.name}`}
                      onClick={() => startEdit(item)}
                    >
                      <Pencil />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}
