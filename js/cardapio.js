import { supabase } from './supabase.js'

// Carrega config do restaurante
async function carregarConfig() {
  const { data } = await supabase.from('config').select('*').single()
  if (!data) return

  document.title = data.nome || 'Cardápio'
  document.getElementById('nome-restaurante').textContent = data.nome || ''
  window.whatsappRestaurante = data.whatsapp || '5500000000000' 
  document.getElementById('horario-restaurante').textContent = data.horario || ''

  if (data.logo_url) {
    document.getElementById('logo').src = data.logo_url
  }
}

// Carrega categorias e monta a nav
async function carregarCategorias() {
  const { data: categorias } = await supabase
    .from('categorias')
    .select('*')
    .order('ordem')

  const lista = document.getElementById('categorias-lista')

  // Botão "Todos"
  const btnTodos = document.createElement('button')
  btnTodos.className = 'categoria-btn ativo'
  btnTodos.textContent = 'Todos'
  btnTodos.onclick = () => filtrarCategoria(null, btnTodos)
  lista.appendChild(btnTodos)

  categorias.forEach(cat => {
    const btn = document.createElement('button')
    btn.className = 'categoria-btn'
    btn.textContent = cat.nome
    btn.onclick = () => filtrarCategoria(cat.id, btn)
    lista.appendChild(btn)
  })
}

// Filtra produtos por categoria
function filtrarCategoria(categoriaId, btnClicado) {
  document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('ativo'))
  btnClicado.classList.add('ativo')

  const cards = document.querySelectorAll('.produto-card')
  cards.forEach(card => {
    if (!categoriaId || card.dataset.categoria === categoriaId) {
      card.style.display = 'block'
    } else {
      card.style.display = 'none'
    }
  })
}

// Carrega e renderiza produtos
async function carregarProdutos() {
  const { data: produtos } = await supabase
    .from('produtos')
    .select('*, categorias(nome)')
    .eq('ativo', true)
    .order('ordem')

  const grid = document.getElementById('produtos-grid')

  produtos.forEach(produto => {
    const card = document.createElement('div')
    card.className = 'produto-card'
    card.dataset.categoria = produto.categoria_id

    const temPromocao = produto.preco_promocional && produto.preco_promocional < produto.preco
    const precoExibido = temPromocao ? produto.preco_promocional : produto.preco

    card.innerHTML = `
      ${produto.imagem_url
        ? `<img src="${produto.imagem_url}" alt="${produto.nome}" loading="lazy" />`
        : `<div class="produto-card-placeholder">🍔</div>`
      }
      <div class="produto-card-info">
        ${temPromocao ? `<span class="produto-card-badge">OFERTA</span>` : ''}
        <p class="produto-card-nome">${produto.nome}</p>
        ${temPromocao ? `<p class="produto-card-preco-antigo">R$ ${produto.preco.toFixed(2).replace('.', ',')}</p>` : ''}
        <p class="produto-card-preco">R$ ${precoExibido.toFixed(2).replace('.', ',')}</p>
      </div>
    `

    card.onclick = () => {
      // Dispara evento para o modal.js
      window.abrirModal(produto)
    }

    grid.appendChild(card)
  })
}

// Inicia tudo
carregarConfig()
carregarCategorias()
carregarProdutos()

// Adicione no final do arquivo, depois das 3 funções de inicialização
window.addEventListener('load', () => {
  window.atualizarBotaoCarrinho()
})