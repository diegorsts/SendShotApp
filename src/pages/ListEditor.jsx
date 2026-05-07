import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../utils/auth'
import { carregarOuCriarListaJson, salvarArquivoJson } from '../utils/onedrive'
import styles from './ListEditor.module.css'

const EXEMPLO = [
  { categoria: 'Categoria A', itens: ['Item 1', 'Item 2'] },
  { categoria: 'Categoria B', itens: ['Item 1', 'Item 2'] },
]

function Toast({ msg, type, show }) {
  return (
    <div className={`${styles.toast} ${show ? styles.toastShow : ''} ${type ? styles[`toast_${type}`] : ''}`}>
      {msg}
    </div>
  )
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export default function ListEditor() {
  const { userId }  = useParams()
  const navigate    = useNavigate()
  const { token }   = useAuth()

  const usuario = (() => { try { return JSON.parse(decodeURIComponent(userId)) } catch { return null } })()

  const [dados,         setDados]         = useState([])
  const [openCards,     setOpenCards]     = useState(new Set([0]))
  const [listaFolderId, setListaFolderId] = useState(null)
  const [carregando,    setCarregando]    = useState(true)
  const [salvando,      setSalvando]      = useState(false)
  const [abaAtiva,      setAbaAtiva]      = useState('editor')
  const [subTitle,      setSubTitle]      = useState('carregando List.json...')
  const [toast,         setToast]         = useState({ msg: '', type: '', show: false })

  function showToast(msg, type = '') {
    setToast({ msg, type, show: true })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500)
  }

  useEffect(() => {
    if (!usuario || !token) return
    setSubTitle(usuario.temPasta ? 'carregando List.json...' : 'criando estrutura de pastas...')
    carregarOuCriarListaJson(token, usuario)
      .then(({ listaFolderId: fid, dadosLista }) => {
        setListaFolderId(fid)
        setDados(dadosLista)
        setOpenCards(new Set(dadosLista.length > 0 ? [0] : []))
        setSubTitle(dadosLista.length === 0 ? 'List.json vazio — adicione categorias' : 'editando List.json')
      })
      .catch(e => { showToast('❌ ' + e.message, 'error'); setSubTitle('erro ao carregar') })
      .finally(() => setCarregando(false))
  }, [])

  function toggleCard(idx) {
    setOpenCards(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function addCategoria() {
    setDados(d => { const novo = [...d, { categoria: '', itens: [''] }]; setOpenCards(prev => new Set([...prev, novo.length - 1])); return novo })
  }

  function removeCategoria(ci) {
    setDados(d => d.filter((_, i) => i !== ci))
    setOpenCards(prev => { const next = new Set(); prev.forEach(i => { if (i !== ci) next.add(i > ci ? i - 1 : i) }); return next })
  }

  function updateCategoria(ci, val) { setDados(d => d.map((c, i) => i === ci ? { ...c, categoria: val } : c)) }
  function addItem(ci)              { setDados(d => d.map((c, i) => i === ci ? { ...c, itens: [...c.itens, ''] } : c)) }
  function removeItem(ci, ii)       { setDados(d => d.map((c, i) => i === ci ? { ...c, itens: c.itens.filter((_, j) => j !== ii) } : c)) }
  function updateItem(ci, ii, val)  { setDados(d => d.map((c, i) => i === ci ? { ...c, itens: c.itens.map((it, j) => j === ii ? val : it) } : c)) }

  function buildJson() {
    return dados.filter(c => c.categoria.trim()).map(c => ({ categoria: c.categoria.trim(), itens: c.itens.filter(i => i.trim()) }))
  }

  async function salvarLista() {
    if (!listaFolderId) return
    setSalvando(true)
    try {
      await salvarArquivoJson(token, listaFolderId, 'List.json', buildJson())
      showToast('✅ List.json salvo com sucesso!', 'success')
      setSubTitle('salvo às ' + new Date().toLocaleTimeString('pt-BR'))
    } catch (e) {
      showToast('❌ Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSalvando(false)
    }
  }

  function copiarJson() {
    navigator.clipboard?.writeText(JSON.stringify(buildJson(), null, 2))
    showToast('✅ JSON copiado!', 'success')
  }

  if (!usuario) return null

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.glow2} />
      <div className={styles.container}>

        <div className={styles.header}>
          <button className={styles.btnBack} onClick={() => navigate('/dashboard')}>← voltar</button>
          <div className={styles.headerInfo}>
            <div className={styles.userName}>{usuario.name}</div>
            <div className={styles.userSub}>{subTitle}</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Editor de Lista</div>

          <div className={styles.tabBar}>
            <button className={`${styles.tab} ${abaAtiva === 'editor' ? styles.tabActive : ''}`} onClick={() => setAbaAtiva('editor')}>Editor visual</button>
            <button className={`${styles.tab} ${abaAtiva === 'preview' ? styles.tabActive : ''}`} onClick={() => setAbaAtiva('preview')}>Prévia JSON</button>
          </div>

          {abaAtiva === 'editor' && (
            <>
              {carregando ? (
                <div className={styles.loadingState}>carregando...</div>
              ) : (
                <div className={styles.catList}>
                  {dados.length === 0 && (
                    <div className={styles.emptyState}>nenhuma categoria.<br />clique em "+ categoria" para começar.</div>
                  )}
                  {dados.map((cat, ci) => (
                    <div key={ci} className={styles.catCard}>
                      <div className={styles.catHeader} onClick={() => toggleCard(ci)}>
                        <input className={styles.catNameInput} value={cat.categoria} placeholder="nome da categoria"
                          onChange={e => updateCategoria(ci, e.target.value)} onClick={e => e.stopPropagation()} />
                        <span className={styles.badgeCount}>{cat.itens.filter(i => i.trim()).length}</span>
                        <button className={styles.btnIcon} onClick={e => { e.stopPropagation(); removeCategoria(ci) }}>✕</button>
                        <span className={`${styles.catArrow} ${openCards.has(ci) ? styles.catArrowOpen : ''}`}>▶</span>
                      </div>
                      {openCards.has(ci) && (
                        <div className={styles.catBody}>
                          <div className={styles.itemsList}>
                            {cat.itens.map((item, ii) => (
                              <div key={ii} className={styles.itemRow}>
                                <input className={styles.itemInput} value={item} placeholder="nome do item"
                                  onChange={e => updateItem(ci, ii, e.target.value)} />
                                <button className={styles.btnIcon} onClick={() => removeItem(ci, ii)}>✕</button>
                              </div>
                            ))}
                          </div>
                          <button className={styles.btnAddItem} onClick={() => addItem(ci)}>+ adicionar item</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.editorActions}>
                <button className={styles.btnSecondary} onClick={addCategoria}>+ categoria</button>
                <button className={styles.btnSecondary} onClick={() => { setDados(JSON.parse(JSON.stringify(EXEMPLO))); setOpenCards(new Set([0])) }}>↺ exemplo</button>
              </div>

              <button className={styles.btnSave} onClick={salvarLista} disabled={salvando || carregando}>
                {salvando && <span className={styles.spinner} />}
                <span>{salvando ? 'salvando...' : '💾 Salvar List.json'}</span>
              </button>
            </>
          )}

          {abaAtiva === 'preview' && (
            <>
              <pre className={styles.jsonPreview}>{JSON.stringify(buildJson(), null, 2)}</pre>
              <button className={styles.btnSecondary} style={{ marginTop: 10, width: '100%' }} onClick={copiarJson}>copiar JSON</button>
            </>
          )}
        </div>

      </div>
      <Toast msg={toast.msg} type={toast.type} show={toast.show} />
    </div>
  )
}
