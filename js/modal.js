import { supabase } from './supabase.js'

let quantidadeAtual = 1
let produtoAtual = null
let adicionaisSelecionados = []

window.abrirModal = async function(produto) {
  produtoAtual = produto
  quantidadeAtual = 1
  adicionaisSelecionados = []

  // Preenche os dados básicos
  document.getElementById('modal-nome').textContent = produto.nome
  document.getElementById('modal-descricao').textContent = produto.descricao || ''
  document.getElementById('qtd-valor').textContent = '1'
  document.getElementById('modal-obs').value = ''

  // Preço (com ou sem promoção)
  const temPromocao = produto.preco_promocional && produto.preco_promocional < produto.preco
  const precoFinal = temPromocao ? produto.preco_promocional : produto.preco
  document.getElementById('modal-preco').textContent =
    'R$ ' + precoFinal.toFixed(2).replace('.', ',')

  // Imagem
  const img = document.getElementById('modal-imagem')
  if (produto.imagem_url) {
    img.src = produto.imagem_url
    img.style.display = 'block'
  } else {
    img.style.display = 'none'
  }

 // Carrega adicionais pelos grupos vinculados ao produto
  const { data: pgs } = await supabase
    .from('produto_grupos')
    .select('grupo_id')
    .eq('produto_id', produto.id)

  const grupoIds = (pgs || []).map(pg => pg.grupo_id)

  const container = document.getElementById('modal-adicionais')
  container.innerHTML = ''

  if (grupoIds.length > 0) {
    const { data: itens } = await supabase
      .from('itens_grupo_adicional')
      .select('*')
      .in('grupo_id', grupoIds)

    if (itens && itens.length > 0) {
      const titulo = document.createElement('p')
      titulo.style.cssText = 'font-weight:600;margin-bottom:8px;font-size:15px;'
      titulo.textContent = 'Adicionais'
      container.appendChild(titulo)

      itens.forEach(ad => {
        const item = document.createElement('label')
        item.className = 'adicional-item'
        item.innerHTML = `
          <input type="checkbox" value="${ad.id}" data-nome="${ad.nome}" data-preco="${ad.preco}" />
          <span style="flex:1">${ad.nome}</span>
          <span style="color:#e63946;font-weight:600">
            + R$ ${ad.preco.toFixed(2).replace('.', ',')}
          </span>
        `
        item.querySelector('input').addEventListener('change', atualizarAdicionais)
        container.appendChild(item)
      })
    }
  }

  // Botão adicionar ao carrinho
  document.getElementById('btn-adicionar').onclick = adicionarAoCarrinho

  // Abre o modal
  // Abre o modal
    const overlay = document.getElementById('modal-overlay')
    overlay.classList.remove('hidden')
    setTimeout(() => overlay.classList.add('visivel'), 10)
    document.body.style.overflow = 'hidden'
}

function atualizarAdicionais() {
  adicionaisSelecionados = []
  document.querySelectorAll('#modal-adicionais input:checked').forEach(input => {
    adicionaisSelecionados.push({
      id: input.value,
      nome: input.dataset.nome,
      preco: parseFloat(input.dataset.preco)
    })
  })
}

window.mudarQtd = function(delta) {
  quantidadeAtual = Math.max(1, quantidadeAtual + delta)
  document.getElementById('qtd-valor').textContent = quantidadeAtual
}

window.fecharModal = function(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return
  const overlay = document.getElementById('modal-overlay')
  overlay.classList.remove('visivel')
  setTimeout(() => {
    overlay.classList.add('hidden')
    document.body.style.overflow = ''
  }, 280)
}

function adicionarAoCarrinho() {
  const temPromocao = produtoAtual.preco_promocional && produtoAtual.preco_promocional < produtoAtual.preco
  const precoBase = temPromocao ? produtoAtual.preco_promocional : produtoAtual.preco
  const precoAdicionais = adicionaisSelecionados.reduce((s, a) => s + a.preco, 0)
  const precoUnitario = precoBase + precoAdicionais

  const item = {
    id: produtoAtual.id,
    nome: produtoAtual.nome,
    preco: precoUnitario,
    quantidade: quantidadeAtual,
    adicionais: [...adicionaisSelecionados],
    observacao: document.getElementById('modal-obs').value
  }

  // Salva no carrinho (localStorage)
  const raw = JSON.parse(localStorage.getItem('carrinho') || '[]')
  const carrinho = Array.isArray(raw) ? raw : (Array.isArray(raw.carrinho) ? raw.carrinho : [])
  carrinho.push(item)
  localStorage.setItem('carrinho', JSON.stringify(carrinho))

  // Atualiza o botão flutuante
  window.atualizarBotaoCarrinho()

// Fecha o modal
  const overlay = document.getElementById('modal-overlay')
  overlay.classList.remove('visivel')
  setTimeout(() => {
    overlay.classList.add('hidden')
    document.body.style.overflow = ''
  }, 280)
}