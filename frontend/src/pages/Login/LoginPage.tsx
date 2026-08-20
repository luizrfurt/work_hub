import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BrandLogo } from '../../components/BrandLogo'
import { ErrorAlert } from '../../components/ErrorAlert'
import { Field } from '../../components/Field'
import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage, homePath } from '../../utils/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const current = await login(username, password)
      navigate(homePath(current.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Usuário ou senha inválidos.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[420px] px-[18px] py-7 pb-[60px]">
      <header className="mb-4">
        <div className="mb-3 flex items-center gap-3">
          <BrandLogo size={48} />
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">WorkHub</h1>
        </div>
        <p className="leading-[1.45] text-muted-foreground">
          Comunicação e tarefas da equipe, em um só lugar.
        </p>
      </header>
      <Card>
        <CardContent>
          <form className="grid gap-[1.15rem]" onSubmit={(event) => void handleSubmit(event)}>
            {error && <ErrorAlert>{error}</ErrorAlert>}
            <Field label="Usuário">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Senha">
              <PasswordField
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Button className="mt-[0.35rem] w-full" type="submit" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
