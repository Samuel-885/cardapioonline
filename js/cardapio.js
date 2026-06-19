import { supabase } from './supabase.js'

let todosProdutos = []
let restauranteAberto = true

// ===== CONFIG =====
async function carregarConfig() {
  const { data } = await supabase.from('config').select('*').single()
  if (!data) return

  document.title = data.nome || 'Cardápio'
  document.getElementById('nome-restaurante').textContent = data.nome || ''
  document.getElementById('horario-restaurante').textContent = data.horario || ''
  window.whatsappRestaurante = data.whatsapp || '5500000000000'

  if (data.logo_url) document.getElementById('logo').src = data.logo_url

  // Verifica se está aberto
  verificarHorario(data.horario)
}

function verificarHorario(horarioTexto) {
  const bannerEl = document.getElementById('banner-fechado')
  const bannerTexto = document.getElementById('banner-horario-texto')

  // Tenta parsear o horário — ex: "Seg–Sex: 18h às 23h | Sab–Dom: 12h às 23h"
  const agora = new Date()
  const hora = agora.getHours()
  const minuto = agora.getMinutes()
  const horaAtual = hora + minuto / 60

  // Extrai todos os intervalos "Xh às Yh" do texto
  const matches = [...(horarioTexto || '').matchAll(/(\d+)h\s*às\s*(\d+)h/g)]

  let aberto = false
  if (matches.length === 0) {
    aberto = true // Se não conseguiu parsear, assume aberto
  } else {
    for (const m of matches) {
      const inicio = parseInt(m[1])
      const fim = parseInt(m[2])
      if (horaAtual >= inicio && horaAtual < fim) { aberto = true; break }
    }
  }

  restauranteAberto = aberto
  window.restauranteAberto = aberto

  if (aberto) {
    statusEl.textContent = 'Aberto'
    statusEl.className = 'aberto'
  } else {
    statusEl.textContent = 'Fechado'
    statusEl.className = 'fechado'
    bannerEl.classList.remove('hidden')
    bannerTexto.textContent = `Horário: ${horarioTexto || ''}`

    // Bloqueia o botão de finalizar
    setTimeout(() => {
      const btnFinalizar = document.getElementById('btn-finalizar')
      if (btnFinalizar) {
        btnFinalizar.disabled = true
        btnFinalizar.textContent = 'Restaurante fechado no momento'
        btnFinalizar.style.background = '#ccc'
      }
    }, 500)
  }
}

// ===== CATEGORIAS =====
async function carregarCategorias(categorias) {
  const lista = document.getElementById('categorias-lista')
  lista.innerHTML = ''

  // Botão Ofertas
  const btnOfertas = document.createElement('button')
  btnOfertas.className = 'categoria-btn ativo'
  btnOfertas.textContent = 'Ofertas'
  btnOfertas.dataset.target = 'secao-ofertas'
  btnOfertas.onclick = () => rolarParaSecao('secao-ofertas', btnOfertas)
  lista.appendChild(btnOfertas)

  // Botão Mais Pedidos
  const btnMaisPedidos = document.createElement('button')
  btnMaisPedidos.className = 'categoria-btn'
  btnMaisPedidos.textContent = 'Favoritos'
  btnMaisPedidos.dataset.target = 'secao-mais-pedidos'
  btnMaisPedidos.onclick = () => rolarParaSecao('secao-mais-pedidos', btnMaisPedidos)
  lista.appendChild(btnMaisPedidos)

  categorias.forEach(cat => {
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
  const offset = 180
  const top = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top, behavior: 'smooth' })
  document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('ativo'))
  btn.classList.add('ativo')
}

// ===== PRODUTOS =====
async function carregarProdutos() {
  const { data: categorias } = await supabase
    .from('categorias').select('*').order('ordem')

  const { data: produtos } = await supabase
    .from('produtos')
    .select('*, categorias(nome)')
    .eq('ativo', true)
    .order('ordem')

  todosProdutos = produtos || []

  await carregarCategorias(categorias || [])
  renderizarOfertas()
  renderizarMaisPedidos()
  renderizarSecoesCategorias(categorias || [])
  iniciarScrollSpy()
  atualizarContadores()
}

function criarCard(produto, classes = '') {
  const temPromocao = produto.preco_promocional && produto.preco_promocional < produto.preco
  const precoExibido = temPromocao ? produto.preco_promocional : produto.preco

  const card = document.createElement('div')
  card.className = `produto-card ${classes}`
  card.dataset.id = produto.id

  card.innerHTML = `
    <div class="produto-card-img-wrapper">
      ${produto.imagem_url
        ? `<img src="${produto.imagem_url}" alt="${produto.nome}" loading="lazy" />`
        : `<div class="produto-card-placeholder">🍔</div>`
      }
      ${temPromocao ? `<span class="produto-card-oferta-badge">% OFERTA</span>` : ''}
    </div>
    <div class="produto-card-info">
      <p class="produto-card-nome">${produto.nome}</p>
      <span class="produto-card-preco-antigo ${temPromocao ? 'visivel' : ''}">
        ${temPromocao ? `R$ ${produto.preco.toFixed(2).replace('.', ',')}` : '&nbsp;'}
      </span>
      <p class="produto-card-preco">R$ ${precoExibido.toFixed(2).replace('.', ',')}</p>
    </div>
  `

  card.onclick = () => {
  card.classList.remove('clicado')
  void card.offsetWidth // força reflow para reiniciar animação
  card.classList.add('clicado')
  setTimeout(() => window.abrirModal(produto), 120)
  }
  return card
}

function renderizarOfertas() {
  const ofertas = todosProdutos.filter(p => p.preco_promocional && p.preco_promocional < p.preco)
  const secao = document.getElementById('secao-ofertas')
  const grid = document.getElementById('ofertas-grid')
  grid.innerHTML = ''

  if (ofertas.length === 0) return
  secao.classList.remove('hidden')

  ofertas.forEach(p => {
    const card = document.createElement('div')
    card.className = 'oferta-card'
    card.onclick = () => window.abrirModal(p)
    card.innerHTML = `
      ${p.imagem_url
        ? `<img class="oferta-card-img" src="${p.imagem_url}" alt="${p.nome}" loading="lazy" />`
        : `<div class="oferta-card-placeholder">🍔</div>`
      }
      <div class="oferta-card-info">
        <span class="oferta-badge">OFERTA</span>
        <p class="oferta-nome">${p.nome}</p>
        <p class="oferta-preco-antigo">R$ ${p.preco.toFixed(2).replace('.', ',')}</p>
        <p class="oferta-preco">R$ ${p.preco_promocional.toFixed(2).replace('.', ',')}</p>
      </div>
    `
    grid.appendChild(card)
  })
}

function renderizarMaisPedidos() {
  // Pega os 6 primeiros produtos como "mais pedidos" (no futuro pode ser por contagem real)
  const maisPedidos = todosProdutos.slice(0, 6)
  const secao = document.getElementById('secao-mais-pedidos')
  const carrossel = document.getElementById('mais-pedidos-carrossel')
  carrossel.innerHTML = ''

  if (maisPedidos.length === 0) return
  secao.classList.remove('hidden')

  maisPedidos.forEach(p => {
    const precoExibido = p.preco_promocional && p.preco_promocional < p.preco
      ? p.preco_promocional : p.preco

    const card = document.createElement('div')
    card.className = 'mp-card'
    card.onclick = () => window.abrirModal(p)
    card.innerHTML = `
      ${p.imagem_url
        ? `<img src="${p.imagem_url}" alt="${p.nome}" loading="lazy" />`
        : `<div class="mp-card-placeholder">🍔</div>`
      }
      <div class="mp-card-info">
        <p class="mp-card-nome">${p.nome}</p>
        <p class="mp-card-preco">R$ ${precoExibido.toFixed(2).replace('.', ',')}</p>
      </div>
    `
    carrossel.appendChild(card)
  })
}

function renderizarSecoesCategorias(categorias) {
  const container = document.getElementById('secoes-categorias')
  container.innerHTML = ''

  categorias.forEach(cat => {
    const produtos = todosProdutos.filter(p => p.categoria_id === cat.id)
    if (produtos.length === 0) return

    const secao = document.createElement('section')
    secao.className = 'categoria-secao'
    secao.id = `cat-${cat.id}`

    const grid = document.createElement('div')
    grid.className = 'categoria-grid'
    produtos.forEach(p => grid.appendChild(criarCard(p)))

    secao.innerHTML = `
      <div class="categoria-secao-header">
        <span class="categoria-secao-label">Cardápio</span>
        <h2 class="categoria-secao-titulo">${cat.nome}</h2>
      </div>
    `
    secao.appendChild(grid)
    container.appendChild(secao)
  })
}

// ===== SCROLL SPY =====
function iniciarScrollSpy() {
  const secoes = document.querySelectorAll('section[id], .categoria-secao[id]')
  const offset = 200

  window.addEventListener('scroll', () => {
    let atual = null
    secoes.forEach(secao => {
      const top = secao.getBoundingClientRect().top
      if (top <= offset) atual = secao.id
    })

    if (atual) {
      document.querySelectorAll('.categoria-btn').forEach(btn => {
        btn.classList.toggle('ativo', btn.dataset.target === atual)
      })
    }
  }, { passive: true })
}

// ===== BUSCA =====
let buscaAberta = false

window.toggleBusca = function() {
  const wrapper = document.getElementById('busca-wrapper')
  buscaAberta = !buscaAberta
  wrapper.classList.toggle('busca-aberta', buscaAberta)

  if (buscaAberta) {
    // Mostra header e nav antes de abrir busca
    headerEl.style.transform = 'translateY(0)'
    navEl.style.transform = 'translateY(0)'
    headerLastScroll = window.scrollY
    setTimeout(() => document.getElementById('busca-input').focus(), 300)
  } else {
    limparBusca()
  }
}

  const inputBusca = document.getElementById('busca-input')
  const resultadosEl = document.getElementById('busca-resultados')
  const resultadosGrid = document.getElementById('busca-resultados-grid')
  const conteudoPrincipal = document.getElementById('conteudo-principal')

  inputBusca.addEventListener('input', () => {
    const termo = inputBusca.value.trim().toLowerCase()

    if (!termo) {
      resultadosEl.classList.add('hidden')
      conteudoPrincipal.classList.remove('hidden')
      return
    }

    resultadosEl.classList.remove('hidden')
    conteudoPrincipal.classList.add('hidden')

    const filtrados = todosProdutos.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.descricao || '').toLowerCase().includes(termo)
    )

    resultadosGrid.innerHTML = ''

    if (filtrados.length === 0) {
      resultadosGrid.innerHTML = `<p style="color:var(--ink-muted);padding:20px 0;grid-column:1/-1">Nenhum produto encontrado para "<strong>${termo}</strong>"</p>`
      return
    }

    filtrados.forEach(p => resultadosGrid.appendChild(criarCard(p)))
  })

  window.limparBusca = function() {
    document.getElementById('busca-input').value = ''
    resultadosEl.classList.add('hidden')
    conteudoPrincipal.classList.remove('hidden')
  }

  // ===== HIDE BUSCA NO SCROLL =====
  let lastScrollY = 0

  window.addEventListener('scroll', () => {
    const current = window.scrollY
    if (current > lastScrollY && current > 60 && buscaAberta) {
      buscaAberta = false
      document.getElementById('busca-wrapper').classList.remove('busca-aberta')
      limparBusca()
    }
    lastScrollY = current
  }, { passive: true })

// ===== CONTADORES NO CARD =====
window.atualizarContadores = function() {
  const raw = JSON.parse(localStorage.getItem('carrinho') || '[]')
  const carrinho = Array.isArray(raw) ? raw : []

  // Remove contadores antigos
  document.querySelectorAll('.produto-card-contador').forEach(el => el.remove())

  // Adiciona contadores
  const contagem = {}
  carrinho.forEach(item => {
    contagem[item.id] = (contagem[item.id] || 0) + item.quantidade
  })

  Object.entries(contagem).forEach(([id, qtd]) => {
    document.querySelectorAll(`.produto-card[data-id="${id}"]`).forEach(card => {
      const badge = document.createElement('div')
      badge.className = 'produto-card-contador'
      badge.textContent = qtd
      card.appendChild(badge)
    })
  })
}

// ===== HEADER AUTO-HIDE =====
// ===== HEADER AUTO-HIDE =====
let headerLastScroll = 0
let headerTicking = false
const headerEl = document.getElementById('header')
const navEl = document.getElementById('categorias-nav')

window.addEventListener('scroll', () => {
  if (headerTicking) return
  headerTicking = true

  requestAnimationFrame(() => {
    const current = window.scrollY
    const diff = current - headerLastScroll

    if (current <= 80) {
      headerEl.style.transform = 'translateY(0)'
      navEl.style.transform = 'translateY(0)'
    } else if (diff > 6) {
      headerEl.style.transform = 'translateY(-100%)'
      navEl.style.transform = 'translateY(-100%)'
      if (buscaAberta) {
        buscaAberta = false
        document.getElementById('busca-wrapper').classList.remove('busca-aberta')
        limparBusca()
      }
    } else if (diff < -6) {
      headerEl.style.transform = 'translateY(0)'
      navEl.style.transform = 'translateY(0)'
    }

    headerLastScroll = current
    headerTicking = false
  })
}, { passive: true })

// ===== INIT =====
carregarConfig()
carregarProdutos()