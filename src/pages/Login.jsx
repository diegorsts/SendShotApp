import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../utils/auth'
import styles from './Login.module.css'

export default function Login() {
  const { token, fazerLogin, salvarSessao, determinarNivel } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) { navigate('/dashboard'); return }

    const hash   = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const tkn    = params.get('access_token')
    if (!tkn) return

    window.history.replaceState({}, document.title, window.location.pathname)

    async function processarToken() {
      try {
        const [userResp, gruposResp] = await Promise.all([
          fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${tkn}` } }),
          fetch('https://graph.microsoft.com/v1.0/me/memberOf', { headers: { Authorization: `Bearer ${tkn}` } }),
        ])
        const user   = await userResp.json()
        const grupos = await gruposResp.json()
        const ids    = (grupos.value || []).map(g => g.id)
        const nivel  = determinarNivel(ids)
        salvarSessao(tkn, {
          displayName: user.displayName || '',
          email: user.mail || user.userPrincipalName || '',
        }, nivel)
        navigate('/dashboard')
      } catch (e) {
        console.error('Erro ao processar token:', e)
      }
    }

    processarToken()
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.glow2} />
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>📡</div>
            <div className={styles.logoText}>Send<span>Shot</span></div>
          </div>
          <h1>Painel <em>Admin</em></h1>
          <p className={styles.subtitle}>// gerenciamento de configurações</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Autenticação Microsoft</div>
          <div className={styles.authSection}>
            <button className={styles.btnMicrosoft} onClick={fazerLogin}>
              <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              Entrar com Microsoft
            </button>
            <div className={`${styles.statusBadge} ${styles.disconnected}`}>
              <div className={styles.statusDot} />
              <span>não conectado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
