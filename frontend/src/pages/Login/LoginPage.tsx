import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage, homePath } from '../../utils/format'

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
    <div className="wrap narrow">
      <header className="hero">
        <h1>WorkHub</h1>
        <p className="sub">Comunicação e tarefas da equipe, em um só lugar.</p>
      </header>
      <form className="card login-form" onSubmit={(event) => void handleSubmit(event)}>
        {error && <div className="alert">{error}</div>}
        <label>
          Usuário
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="seu.usuario"
            required
          />
        </label>
        <label>
          Senha
          <PasswordField
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </label>
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
