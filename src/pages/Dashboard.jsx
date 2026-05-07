import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, GRUPOS } from '../utils/auth'
import {
  inicializarOneDrive, salvarArquivoJson,
  carregarUsuariosComStatus, getRootFolderId
} from '../utils/onedrive'
import styles from './Dashboard.module.css'

const NIVEL_CONFIG = {
  globalAdmin: { label: '👑 Global Admin', classe: 'globalAdmin' },
  admin:       { label: '🛡️ Admin',        classe: 'admin'       },
  user:        { label: '👤 Usuário',       classe: 'user'        },
}

function Toast({ msg, type, show }) {
  return (
    <div className={`${styles.toast} ${show ? styles.toastShow : ''} ${type ? styles[`toast_${type}`] : ''}`}>
      {msg}
    </div>
  )
}

export default function Dashboard() {
  const { token, user, nivelAcesso, fazerLogoff } = useAuth()
  const navigate = useNavigate()

  const [driveStatus,  setDriveStatus]  = useState('verificando...')
  const [gpsFolderId,  setGpsFolderId]  = useState(null)
  const [chaveAtual,   setChaveAtual]   = useState(null)
  const [apiKeyInput,  setApiKeyInput]  = useState('')
  const [salvando,     setSalvando]     = useState(false)
  const [mostrarChave, setMostrarChave] = useState(false)
  const [usuarios,     setUsuarios]     = useState([])
  const [carregandoU,  setCarregandoU]  = useState(false)
  const [buscaUser,    setBuscaUser]    = useState('')
  const [toast,        setToast]        = useState({ msg: '', type: '', show: false })

  const isAdmin = nivelAcesso === 'admin' || nivelAcesso === 'globalAdmin'

  function showToast(msg, type = '') {
    setToast({ msg, type, show: true })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500)
  }

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    if (!isAdmin) return
    inicializarOneDrive(token)
      .then(({ gpsFolderId: gid, chaveAtual: chave }) => {
        setGpsFolderId(gid)
        setChaveAtual(chave)
        setDriveStatus('✅ conectado')
      })
      .catch(() => setDriveStatus('❌ erro ao conectar'))
  }, [token])

  async function salvarChave() {
    if (!apiKeyInput.trim() || !gpsFolderId) return
    setSalvando(true)
    try {
      await salvarArquivoJson(token, gpsFolderId, 'config.json', {
        apiKey: apiKeyInput.trim(), updatedAt: new Date().toISOString(), version: Date.now(),
      })
      setChaveAtual(apiKeyInput.trim())
      setApiKeyInput('')
      showToast('✅ Chave salva com sucesso!', 'success')
    } catch (e) {
      showToast('❌ Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function carregarUsuarios() {
    setCarregandoU(true)
    try {
      const lista = await carregarUsuariosComStatus(token, GRUPOS.user)
      setUsuarios(lista)
    } catch (e) {
      showToast('❌ Erro ao carregar usuários: ' + e.message, 'error')
    } finally {
      setCarregandoU(false)
    }
  }

  function abrirEditor(usuario) {
    navigate(`/lista/${encodeURIComponent(JSON.stringify(usuario))}`)
  }

  const usuariosFiltrados = usuarios.filter(u =>
    u.name.toLowerCase().includes(buscaUser.toLowerCase()) ||
    u.email.toLowerCase().includes(buscaUser.toLowerCase())
  )

  const nivelInfo      = NIVEL_CONFIG[nivelAcesso]
  const chaveMascarada = chaveAtual
    ? chaveAtual.substring(0, 8) + '••••••••••••' + chaveAtual.slice(-4)
    : null

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.glow2} />
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <div>
              <div className={styles.logo}>
                <div className={styles.logoMark}>📡</div>
                <div className={styles.logoText}>Send<span>Shot</span></div>
              </div>
              <h1>Painel <em>Admin</em></h1>
              <p className={styles.subtitle}>// gerenciamento de configurações</p>
            </div>
            <button className={styles.btnLogoff} onClick={fazerLogoff}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              sair
            </button>
          </div>
        </div>

        {/* Sessão Ativa */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>Sessão Ativa</div>
          <div className={styles.infoRow}><span className={styles.key}>usuário</span><span className={styles.val}>{user?.displayName || '—'}</span></div>
          <div className={styles.infoRow}><span className={styles.key}>email</span><span className={styles.val}>{user?.email || '—'}</span></div>
          <div className={styles.infoRow}>
            <span className={styles.key}>nível de acesso</span>
            <span className={styles.val}>
              {nivelInfo
                ? <span className={`${styles.nivelBadge} ${styles[nivelInfo.classe]}`}>{nivelInfo.label}</span>
                : <span className={`${styles.nivelBadge} ${styles.semAcesso}`}>⛔ Sem acesso</span>
              }
            </span>
          </div>
          {isAdmin && (
            <div className={styles.infoRow}><span className={styles.key}>status onedrive</span><span className={styles.val}>{driveStatus}</span></div>
          )}
        </div>

        {/* Acesso negado */}
        {!nivelAcesso && (
          <div className={styles.card}>
            <div className={styles.cardLabel}>Acesso Restrito</div>
            <div className={styles.acessoNegado}>
              <div className={styles.icon}>🔒</div>
              <p>Você não pertence a nenhum grupo autorizado.<br />Entre em contato com o administrador do sistema.</p>
            </div>
          </div>
        )}

        {/* API Key */}
        {isAdmin && (
          <div className={styles.card}>
            <div className={styles.cardLabel}>Chave Google Maps API</div>
            <div className={styles.formGroup}>
              <label>Chave atual</label>
              <div className={`${styles.keyDisplay} ${chaveAtual ? styles.hasKey : ''}`}>
                {chaveMascarada || 'nenhuma chave cadastrada'}
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Nova chave de API</label>
              <div className={styles.inputWrap}>
                <input type={mostrarChave ? 'text' : 'password'} value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)} placeholder="AIzaSy..." autoComplete="off" />
                <button className={styles.toggleVis} onClick={() => setMostrarChave(v => !v)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={salvarChave} disabled={apiKeyInput.trim().length < 10 || salvando}>
              {salvando && <span className={styles.spinner} />}
              <span>{salvando ? 'salvando...' : '💾 Salvar no OneDrive'}</span>
            </button>
          </div>
        )}

        {/* Gerenciar Listas */}
        {isAdmin && (
          <div className={styles.card}>
            <div className={styles.cardLabel}>Gerenciar Lista Multishot</div>
            <button className={styles.btnRefresh} onClick={carregarUsuarios} disabled={carregandoU}>
              <span style={{ display:'inline-block', animation: carregandoU ? 'spin 0.6s linear infinite' : 'none' }}>↺</span>
              {carregandoU ? ' carregando...' : ' atualizar lista'}
            </button>
            {usuarios.length > 0 && (
              <input className={styles.searchInput} type="text" placeholder="buscar usuário..."
                value={buscaUser} onChange={e => setBuscaUser(e.target.value)} />
            )}
            <div className={styles.userList}>
              {usuarios.length === 0 && !carregandoU && (
                <div className={styles.emptyState}>clique em "atualizar lista" para carregar os usuários</div>
              )}
              {usuariosFiltrados.map(u => {
                const iniciais = u.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <div key={u.azureId || u.id || u.name} className={styles.userItem} onClick={() => abrirEditor(u)}>
                    <div className={styles.userAvatar}
                      style={u.temPasta ? {} : { background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                      {iniciais}
                    </div>
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{u.name}</div>
                      <div className={styles.userSub}>
                        {u.email && <span className={styles.userEmail}>{u.email} · </span>}
                        {u.temPasta ? '✅ pasta existente' : '⚠️ sem pasta — será criada'}
                      </div>
                    </div>
                    <span className={styles.userArrow}>→</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
      <Toast msg={toast.msg} type={toast.type} show={toast.show} />
    </div>
  )
}
