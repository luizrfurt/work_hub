import { type InputHTMLAttributes, useState } from 'react'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export function PasswordField({ className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`password-field ${className ?? ''}`.trim()}>
      <input type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.2A2.8 2.8 0 1 0 12 9a2.8 2.8 0 0 0 0 5.8z"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.3 2.3 2 3.6l3.1 3.1C3.2 8.2 1.7 10 1 12c1.7 3.9 6 7 11 7 1.8 0 3.5-.4 5-.9l3.4 3.4 1.3-1.3zM12 17c-3.6 0-6.7-2-8.4-5 1-1.7 2.4-3.1 4.1-4L9.9 10A3.9 3.9 0 0 0 12 16.9zm9.7.1-2.2-2.2c1.3-.8 2.4-1.9 3.2-3.2-1.7-3.9-6-7-11-7-1 0-2 .1-2.9.4L6.5 3.8C8.2 3.3 10 3 12 3c5 0 9.3 3.1 11 7-.8 1.9-2.1 3.5-3.7 4.8zM14.1 12.8l-1.8-1.8a2.8 2.8 0 0 1 1.8 1.8z"
      />
    </svg>
  )
}
