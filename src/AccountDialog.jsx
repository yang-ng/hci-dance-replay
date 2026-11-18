import { useRef, useState } from 'react'
import { authenticateLocalAccount, createLocalAccount, validUsername } from './storage.js'

export default function AccountDialog({ dialog, mode, onModeChange, onContinue }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const usernameInput = useRef(null)
  const creating = mode === 'create'

  function clear() {
    setUsername('')
    setPassword('')
    setConfirmation('')
    setError('')
  }

  function enterWorkspace(profile) {
    dialog.current.close()
    setBusy(false)
    clear()
    onContinue(profile)
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const name = username.trim()
    if (creating && !validUsername(name)) {
      setError('Use 3–32 letters, numbers, periods, hyphens, or underscores. The name “demo” is reserved.')
      return
    }
    if (creating && password !== confirmation) {
      setError('The passwords don’t match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!creating && name.toLowerCase() === 'demo' && password === 'dance-replay') {
        enterWorkspace(null)
        return
      }
      const profile = creating ? await createLocalAccount(name, password) : await authenticateLocalAccount(name, password)
      if (profile) enterWorkspace(profile)
      else setError(creating ? 'That username is already taken in this browser.' : 'The username or password doesn’t match.')
    } catch {
      setError('Account storage is unavailable. Open Dance Replay in your usual browser and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="login-dialog" aria-labelledby="login-title" aria-describedby="login-description"
    onClose={clear} onCancel={event => { if (busy) event.preventDefault() }}>
    <p className="eyebrow">{creating ? 'New user' : 'Welcome back'}</p>
    <h2 id="login-title">{creating ? 'Create your Dance Replay account' : 'Log in to Dance Replay'}</h2>
    <p id="login-description">{creating ? 'Choose a username and password for this browser. Your projects are saved in your own workspace on this device.' : 'Pick up your reviews, comments, and practice projects in this browser.'}</p>
    <form onSubmit={submit} aria-busy={busy}>
      <label className="login-field">Username
        <input ref={usernameInput} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Enter your username" value={username} maxLength={32} required disabled={busy} onChange={event => { setUsername(event.target.value); setError('') }} />
      </label>
      <label className="login-field">Password
        <input name="password" type="password" autoComplete={creating ? 'new-password' : 'current-password'} placeholder={creating ? 'At least 8 characters' : 'Enter your password'} value={password} minLength={creating ? 8 : undefined} maxLength={128} required disabled={busy} onChange={event => { setPassword(event.target.value); setError('') }} />
      </label>
      {creating && <label className="login-field">Confirm password
        <input name="confirmation" type="password" autoComplete="new-password" placeholder="Enter your password again" value={confirmation} maxLength={128} required disabled={busy} onChange={event => { setConfirmation(event.target.value); setError('') }} />
      </label>}
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={busy || !username.trim() || !password || (creating && !confirmation)}>{busy ? (creating ? 'Creating account…' : 'Logging in…') : creating ? 'Create account' : 'Log in'}</button>
    </form>
    <div className="account-options">
      <button type="button" className="secondary" disabled={busy} onClick={() => {
        clear()
        onModeChange(creating ? 'login' : 'create')
        usernameInput.current?.focus()
      }}>{creating ? 'Back to log in' : 'Create a new user'}</button>
      {!creating && <button type="button" className="text-button" disabled={busy} onClick={() => enterWorkspace(null)}>Continue as demo user</button>}
    </div>
    <button type="button" className="login-close" disabled={busy} aria-label="Close account dialog" onClick={() => dialog.current.close()}>×</button>
  </dialog>
}
