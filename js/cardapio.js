import { supabase } from './supabase.js'

let todosProdutos = []
let configLoja = {}
let buscaAberta = false

// ===== CONFIG =====
async function carregarConfig() {
  const { data } = await supabase.from('config').select('*').single()
  if (!data) return
  configLoja = data

  document.title = data.nome || 'Cardápio'
  document.getElementById('perfil-nome').textContent = data.nome || ''
  document.getElementById('header-nome').textContent = data.nome || ''

  if (data.logo_url) {
    document.getElementById('perfil-logo').src = data.logo_url
    document.getElementById('header-logo').src = data.logo_url
  }

  if (data.banner_url) {
    document.getElementById('perfil-banner-img').src = data.banner_url
  }

  window.whatsappRestaurante = data.whatsapp || '5500000000000'
  verificarHorario(data)
  renderizarMeta(data)
}

function verificarHorario(data) {
  const horarioTexto = data.horario || ''
  const agora = new Date()
  const horaAtual = agora.getHours() + agora.getMinutes() / 60
  const matches = [...horarioTexto.matchAll(/(\d+)h\s*às\s*(\d+)h/g)]

  let aberto = matches.length === 0
  for (const m of matches) {
    if (horaAtual >= parseInt(m[1]) && horaAtual < parseInt(m[2])) { aberto = true; break }
  }

  window.restauranteAberto = aberto
  const statusEl = document.getElementById('perfil-status')

  if (aberto) {
    // Extrai horário de fechamento do texto
    const proximoFechamento = matches.find(m => horaAtual < parseInt(m[2]))
    const fechaAs = proximoFechamento ? `Aberto até ${proximoFechamento[2]}h` : 'Aberto'
    statusEl.innerHTML = `<span>🟢</span> ${fechaAs}`
    statusEl.className = 'aberto'
  } else {
    statusEl.innerHTML = `<span>🔴</span> Fechado`
    statusEl.className = 'fechado'
    document.getElementById('banner-fechado').classList.remove('hidden')
    document.getElementById('banner-horario-texto').textContent = `Horário: ${horarioTexto}`
  }
}

function renderizarMeta(data) {
  const meta = document.getElementById('perfil-meta')
  const itens = []

  if (data.tempo_entrega) itens.push(`🕐 ${data.tempo_entrega}`)
  if (data.pedido_minimo) itens.push(`💳 Pedido mín. R$ ${parseFloat(data.pedido_minimo).toFixed(2).replace('.', ',')}`)

  meta.innerHTML = itens.map(i => `<span>${i}</span>`).join('')
}

// ===== INFORMAÇÕES DA LOJA =====
window.abrirInfoLoja = function() {
  const data = configLoja
  const conteudo = document.getElementById('info-conteudo')
  const itens = []

  if (data.horario) itens.push({ icon: '🕐', label: 'Horário', valor: data.horario })
  if (data.endereco) itens.push({ icon: '📍', label: 'Endereço', valor: data.endereco })
  if (data.whatsapp) itens.push({ icon: '📱', label: 'WhatsApp', valor: data.whatsapp })
  if (data.telefone) itens.push({ icon: '📞', label: 'Telefone', valor: data.telefone })
  if (data.instagram) itens.push({ icon: '📸', label: 'Instagram', valor: `@${data.instagram}` })
  if (data.facebook) itens.push({ icon: '👥', label: 'Facebook', valor: data.facebook })
  if (data.tempo_entrega) itens.push({ icon: '🛵', label: 'Tempo de entrega', valor: data.tempo_entrega })
  if (data.pedido_minimo) itens.push({ icon: '💳', label: 'Pedido mínimo', valor: `R$ ${parseFloat(data.pedido_minimo).toFixed(2).replace('.', ',')}` })

  conteudo.innerHTML = itens.map(i => `
    <div class="info-item">
      <span class="info-item-icon">${i.icon}</span>
      <div class="info-item-texto">
        <strong>${i.label}</strong>
        <span>${i.valor}</span>
      </div>
    </div>
  `).join('')

  const overlay = document.getElementById('info-overlay')
  overlay.classList.remove('hidden')
  setTimeout(() => overlay.classList.add('visivel'), 10)
}

window.fecharInfoLoja = function(event) {
  if (event && event.target !== document.getElementById('info-overlay')) return
  const overlay = document.getElementById('info-overlay')
  overlay.classList.remove('visivel')
  setTimeout(() => overlay.classList.add('hidden'), 280)
}

// ===== COMPARTILHAR =====
window.compartilhar = function() {
  if (navigator.share) {
    navigator.share({ title: configLoja.nome, url: window.location.href })
  } else {
    navigator.clipboard.writeText(window.location.href)
    alert('Link copiado!')
  }
}

// ===== PRODUTOS =====
async function carregarProdutos() {
  const { data: categorias } = await supabase.from('categorias').select('*').order('ordem')
  const { data: produtos } = await supabase.from('produtos').select('*, categorias(nome)').eq('ativo', true).order('ordem')

  todosProdutos = produtos || []

  carregarCategorias(categorias || [])
  renderizarOfertas()
  renderizarSecoesCategorias(categorias || [])
  iniciarScrollSpy()
  atualizarContadores()
}

// ===== CATEGORIAS =====
function carregarCategorias(categorias) {
  const lista = document.getElementById('categorias-lista')
  lista.innerHTML = ''

  const temOfertas = todosProdutos.some(p => p.preco_promocional && p.preco_promocional < p.preco)
  if (temOfertas) {
    const btn = document.createElement('button')
    btn.className = 'categoria-btn ativo'
    btn.textContent = '🔥 Ofertas'
    btn.dataset.target = 'secao-ofertas'
    btn.onclick = () => rolarParaSecao('secao-ofertas', btn)
    lista.appendChild(btn)
  }

  categorias.forEach(cat => {
    const temProdutos = todosProdutos.some(p => p.categoria_id === cat.id)
    if (!temProdutos) return
    const btn = document.createElement('button')
    btn.className = 'categoria-btn'
    btn.textContent = cat.nome
    btn.dataset.target = `cat-${cat.id}`
    btn.onclick = () => rolarParaSecao(`cat-${cat.id}`, btn)
    lista.appendChild(btn)
  })
}

function rolarParaSecao(id, btn) {
  const el = document.getElementById(id)
  if (!el) return
  const headerH = document.getElementById('header').classList.contains('header-oculto') ? 0 : 60
  const navH = 44
  const offset = headerH + navH + 8
  const top = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top, behavior: 'smooth' })
  document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('ativo'))
  btn.classList.add('ativo')
}

// ===== OFERTAS CARROSSEL =====
function renderizarOfertas() {
  const ofertas = todosProdutos.filter(p => p.preco_promocional && p.preco_promocional < p.preco)
  const secao = document.getElementById('secao-ofertas')
  const carrossel = document.getElementById('ofertas-carrossel')
  carrossel.innerHTML = ''
  if (ofertas.length === 0) return
  secao.classList.remove('hidden')

  ofertas.forEach(p => {
    const card = document.createElement('div')
    card.className = 'oferta-card'
    card.onclick = () => window.abrirModal(p)
    card.innerHTML = `
      <div class="oferta-card-img-wrapper">
        ${p.imagem_url
          ? `<img src="${p.imagem_url}" alt="${p.nome}" loading="lazy" />`
          : `<div class="oferta-card-placeholder">🍔</div>`
        }
        <span class="oferta-badge">% OFERTA</span>
      </div>
      <div class="oferta-card-info">
        <p class="oferta-nome">${p.nome}</p>
        <span class="oferta-preco-antigo">R$ ${p.preco.toFixed(2).replace('.', ',')}</span>
        <p class="oferta-preco">R$ ${p.preco_promocional.toFixed(2).replace('.', ',')}</p>
      </div>
    `
    carrossel.appendChild(card)
  })
}

// ===== SEÇÕES CATEGORIAS =====
function renderizarSecoesCategorias(categorias) {
  const container = document.getElementById('secoes-categorias')
  container.innerHTML = ''

  categorias.forEach(cat => {
    const produtos = todosProdutos.filter(p => p.categoria_id === cat.id)
    if (produtos.length === 0) return

    const secao = document.createElement('section')
    secao.className = 'categoria-secao'
    secao.id = `cat-${cat.id}`

    const lista = document.createElement('div')
    lista.className = 'produto-lista'
    produtos.forEach(p => lista.appendChild(criarItemProduto(p)))

    secao.innerHTML = `
      <div class="categoria-secao-header">
        <h2 class="categoria-secao-titulo">${cat.nome}</h2>
      </div>
    `
    secao.appendChild(lista)
    container.appendChild(secao)
  })
}

function criarItemProduto(produto) {
  const temPromocao = produto.preco_promocional && produto.preco_promocional < produto.preco
  const precoExibido = temPromocao ? produto.preco_promocional : produto.preco

  const item = document.createElement('div')
  item.className = 'produto-item'
  item.dataset.id = produto.id

  item.innerHTML = `
    <div class="produto-item-texto">
      <p class="produto-item-nome">${produto.nome}</p>
      ${produto.descricao ? `<p class="produto-item-descricao">${produto.descricao}</p>` : ''}
      <div class="produto-item-precos">
        <span class="produto-item-preco-antigo ${temPromocao ? 'visivel' : ''}">
          ${temPromocao ? `R$ ${produto.preco.toFixed(2).replace('.', ',')}` : ''}
        </span>
        <span class="produto-item-preco">R$ ${precoExibido.toFixed(2).replace('.', ',')}</span>
      </div>
    </div>
    <div class="produto-item-img-wrapper">
      ${produto.imagem_url
        ? `<img src="${produto.imagem_url}" alt="${produto.nome}" loading="lazy" />`
        : `<div class="produto-item-placeholder">🍔</div>`
      }
      ${temPromocao ? `<span class="produto-item-oferta-badge">%</span>` : ''}
    </div>
  `

  item.onclick = () => window.abrirModal(produto)
  return item
}

// ===== SCROLL SPY =====
function iniciarScrollSpy() {
  const secoes = document.querySelectorAll('section[id], .categoria-secao[id]')
  window.addEventListener('scroll', () => {
    const offset = 120
    let atual = null
    secoes.forEach(s => {
      if (s.getBoundingClientRect().top <= offset) atual = s.id
    })
    if (atual) {
      document.querySelectorAll('.categoria-btn').forEach(btn => {
        btn.classList.toggle('ativo', btn.dataset.target === atual)
      })
    }
  }, { passive: true })
}

// ===== HEADER SCROLL =====
const headerEl = document.getElementById('header')
const navEl = document.getElementById('categorias-nav')
const perfilEl = document.getElementById('perfil-loja')
let lastScroll = 0
let scrollTicking = false

window.addEventListener('scroll', () => {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    const current = window.scrollY
    const perfilH = perfilEl.offsetHeight

    if (current > perfilH) {
      headerEl.classList.remove('header-oculto')
      navEl.style.top = '60px'
      document.getElementById('busca-wrapper').style.top = '60px'
    } else {
      headerEl.classList.add('header-oculto')
      navEl.style.top = '0px'
      document.getElementById('busca-wrapper').style.top = '0px'
    }

    lastScroll = current
    scrollTicking = false
  })
}, { passive: true })

// ===== BUSCA =====
window.toggleBusca = function() {
  buscaAberta = !buscaAberta
  document.getElementById('busca-wrapper').classList.toggle('busca-aberta', buscaAberta)
  if (buscaAberta) {
    setTimeout(() => document.getElementById('busca-input').focus(), 280)
  } else {
    fecharBusca()
  }
}

window.fecharBusca = function() {
  buscaAberta = false
  document.getElementById('busca-wrapper').classList.remove('busca-aberta')
  document.getElementById('busca-input').value = ''
  document.getElementById('busca-resultados').classList.add('hidden')
  document.getElementById('secoes-categorias').style.display = ''
  document.getElementById('secao-ofertas').style.display = ''
}

document.getElementById('busca-input').addEventListener('input', function() {
  const termo = this.value.trim().toLowerCase()
  const resultadosEl = document.getElementById('busca-resultados')
  const resultadosLista = document.getElementById('busca-resultados-lista')
  const buscarLabel = document.getElementById('busca-label')

  if (!termo) {
    resultadosEl.classList.add('hidden')
    document.getElementById('secoes-categorias').style.display = ''
    document.getElementById('secao-ofertas').style.display = ''
    return
  }

  document.getElementById('secoes-categorias').style.display = 'none'
  document.getElementById('secao-ofertas').style.display = 'none'
  resultadosEl.classList.remove('hidden')

  const filtrados = todosProdutos.filter(p =>
    p.nome.toLowerCase().includes(termo) ||
    (p.descricao || '').toLowerCase().includes(termo)
  )

  buscarLabel.textContent = filtrados.length > 0
    ? `${filtrados.length} resultado(s) para "${termo}"`
    : `Nenhum resultado para "${termo}"`

  resultadosLista.innerHTML = ''
  const lista = document.createElement('div')
  lista.className = 'produto-lista'
  filtrados.forEach(p => lista.appendChild(criarItemProduto(p)))
  resultadosLista.appendChild(lista)
})

// ===== CONTADORES =====
window.atualizarContadores = function() {
  const raw = JSON.parse(localStorage.getItem('carrinho') || '[]')
  const carrinho = Array.isArray(raw) ? raw : []
  document.querySelectorAll('.produto-item-contador').forEach(el => el.remove())

  const contagem = {}
  carrinho.forEach(item => { contagem[item.id] = (contagem[item.id] || 0) + item.quantidade })

  Object.entries(contagem).forEach(([id, qtd]) => {
    document.querySelectorAll(`.produto-item[data-id="${id}"] .produto-item-img-wrapper`).forEach(wrapper => {
      const badge = document.createElement('div')
      badge.className = 'produto-item-contador'
      badge.textContent = qtd
      wrapper.appendChild(badge)
    })
  })
}

// ===== INIT =====
carregarConfig()
carregarProdutos()