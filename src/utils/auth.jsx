import { createContext, useContext, useState } from 'react'

const CLIENT_ID   = '47d9b118-15a2-4529-b8ab-5a6b53422a81'
const TENANT_ID   = '307e784e-af82-47ef-8d7b-90bcab8f7e2c'
const SCOPES      = 'User.Read Files.ReadWrite.All Sites.ReadWrite.All GroupMember.Read.All'

export const GRUPOS = {
  globalAdmin: 'c664222a-9879-4c4c-ada2-f5f16cb336df',
  admin:       '41132fa4-b17f-48c6-a643-4d4b8812fd2b',
  user:        'c320e4bb-5bc1-4292-86d7-e1b94e2b554c',
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token,       setToken]       = useState(() => sessionStorage.getItem('ss_token'))
  const [user,        setUser]        = useState(() => {
    const u = sessionStorage.getItem('ss_user')
    return u ? JSON.parse(u) : null
  })
  const [nivelAcesso, setNivelAcesso] = useState(() => sessionStorage.getItem('ss_nivel'))

  function getRedirectUri() {
    return window.location.origin + import.meta.env.BASE_URL
  }

  function fazerLogin() {
    const uri = getRedirectUri()
    const url =
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
      `client_id=${CLIENT_ID}&response_type=token&` +
      `redirect_uri=${encodeURIComponent(uri)}&` +
      `scope=${encodeURIComponent(SCOPES)}&response_mode=fragment`
    window.location.href = url
  }

  function fazerLogoff() {
    sessionStorage.removeItem('ss_token')
    sessionStorage.removeItem('ss_user')
    sessionStorage.removeItem('ss_nivel')
    setToken(null)
    setUser(null)
    setNivelAcesso(null)
    const uri = getRedirectUri()
    window.location.href =
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout?` +
      `post_logout_redirect_uri=${encodeURIComponent(uri)}`
  }

  function salvarSessao(tkn, userData, nivel) {
    sessionStorage.setItem('ss_token', tkn)
    sessionStorage.setItem('ss_user',  JSON.stringify(userData))
    sessionStorage.setItem('ss_nivel', nivel || '')
    setToken(tkn)
    setUser(userData)
    setNivelAcesso(nivel)
  }

  function determinarNivel(grupos) {
    if (grupos.includes(GRUPOS.globalAdmin)) return 'globalAdmin'
    if (grupos.includes(GRUPOS.admin))       return 'admin'
    if (grupos.includes(GRUPOS.user))        return 'user'
    return null
  }

  return (
    <AuthContext.Provider value={{
      token, user, nivelAcesso,
      fazerLogin, fazerLogoff,
      salvarSessao, determinarNivel,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
