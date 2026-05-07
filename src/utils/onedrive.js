const LINK_COMPARTILHADO = 'https://supporteng-my.sharepoint.com/:f:/g/personal/diegor_support_com_br/EgpP7WPpB-ZMsomjH5ZjI5cB3UG9uhg3aETb4DCKU6cCGQ'
const GPS_FOLDER_NAME    = 'gps'
const CONFIG_FILE_NAME   = 'config.json'

let _driveId      = null
let _rootFolderId = null

export function getDriveId()      { return _driveId }
export function getRootFolderId() { return _rootFolderId }
export const GPS_FOLDER = GPS_FOLDER_NAME
export const CONFIG_FILE = CONFIG_FILE_NAME

export async function resolverLinkCompartilhado(token) {
  const base64 = btoa(unescape(encodeURIComponent(LINK_COMPARTILHADO)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const shareId = `u!${base64}`
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  _driveId      = d?.parentReference?.driveId
  _rootFolderId = d?.id
  return !!(_driveId && _rootFolderId)
}

export async function listarFilhos(token, folderId) {
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${_driveId}/items/${folderId}/children`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  return d.value || []
}

export async function criarPasta(token, parentId, nome) {
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${_driveId}/items/${parentId}/children`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    }
  )
  const d = await r.json()
  return d.id || null
}

export async function obterOuCriarPasta(token, parentId, nome) {
  const filhos = await listarFilhos(token, parentId)
  const existe = filhos.find(f => f.name === nome && f.folder)
  if (existe) return existe.id
  return await criarPasta(token, parentId, nome)
}

export async function lerArquivoJson(token, fileId) {
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${_driveId}/items/${fileId}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!r.ok) return null
  return r.json()
}

export async function salvarArquivoJson(token, parentId, nome, conteudo) {
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' })
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${_driveId}/items/${parentId}:/${nome}:/content`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: blob,
    }
  )
  const d = await r.json()
  return d.id || null
}

export async function inicializarOneDrive(token) {
  const ok = await resolverLinkCompartilhado(token)
  if (!ok) throw new Error('Erro ao conectar ao OneDrive')

  const filhos    = await listarFilhos(token, _rootFolderId)
  const pastaGps  = filhos.find(f => f.name === GPS_FOLDER_NAME && f.folder)
  const gpsFolderId = pastaGps
    ? pastaGps.id
    : await criarPasta(token, _rootFolderId, GPS_FOLDER_NAME)

  const arquivos   = await listarFilhos(token, gpsFolderId)
  const configFile = arquivos.find(f => f.name === CONFIG_FILE_NAME)
  const chaveAtual = configFile
    ? (await lerArquivoJson(token, configFile.id))?.apiKey || null
    : null

  return { gpsFolderId, chaveAtual }
}

export async function buscarMembrosGrupoUser(token, grupoId) {
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/groups/${grupoId}/members?$select=id,displayName,userPrincipalName`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const d = await r.json()
    return (d.value || []).filter(m => m['@odata.type'] === '#microsoft.graph.user')
  } catch {
    return []
  }
}

export async function carregarUsuariosComStatus(token, grupoId) {
  if (!_driveId || !_rootFolderId) await resolverLinkCompartilhado(token)

  const [membros, pastasOneDrive] = await Promise.all([
    buscarMembrosGrupoUser(token, grupoId),
    listarFilhos(token, _rootFolderId),
  ])

  const pastasPorNome = {}
  pastasOneDrive
    .filter(f => f.folder && f.name !== GPS_FOLDER_NAME)
    .forEach(f => { pastasPorNome[f.name] = f })

  let usuarios = []
  if (membros.length > 0) {
    usuarios = membros.map(m => {
      const nome  = m.displayName || m.userPrincipalName || 'Sem nome'
      const pasta = pastasPorNome[nome] || null
      return { id: pasta ? pasta.id : null, name: nome, email: m.userPrincipalName || '', temPasta: !!pasta, azureId: m.id }
    })
  } else {
    usuarios = pastasOneDrive
      .filter(f => f.folder && f.name !== GPS_FOLDER_NAME)
      .map(f => ({ id: f.id, name: f.name, email: '', temPasta: true, azureId: null }))
  }

  return usuarios.sort((a, b) => {
    if (a.temPasta !== b.temPasta) return a.temPasta ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function carregarOuCriarListaJson(token, usuario) {
  let { id: folderId, name: nome, temPasta } = usuario

  if (!temPasta || !folderId) {
    const novaPastaId = await criarPasta(token, _rootFolderId, nome)
    if (!novaPastaId) throw new Error('Não foi possível criar a pasta do usuário')
    folderId = novaPastaId
  }

  const listaFolderId = await obterOuCriarPasta(token, folderId, 'Lista')
  const arquivos      = await listarFilhos(token, listaFolderId)
  const listFile      = arquivos.find(f => f.name === 'List.json')
  const finishFile    = arquivos.find(f => f.name === 'FinishList.json')

  if (!finishFile) await salvarArquivoJson(token, listaFolderId, 'FinishList.json', [])

  let dadosLista = []
  if (listFile) {
    const conteudo = await lerArquivoJson(token, listFile.id)
    dadosLista = Array.isArray(conteudo)
      ? conteudo.map(c => ({ categoria: c.categoria || '', itens: Array.isArray(c.itens) ? c.itens : [] }))
      : []
  }

  return { listaFolderId, dadosLista, folderId }
}
