import { supabase } from './supabase.js'

function getCarrinho() {
  const raw = JSON.parse(localStorage.getItem('carrinho') || '[]')
  return Array.isArray(raw) ? raw : (Array.isArray(raw.carrinho) ? raw.carrinho : [])
}

window.atualizarBotaoCarrinho = function() {
  const carrinho = getCarrinho()
  const btn = document.getElementById('btn-carrinho')
  if (!btn) return

  if (carrinho.length === 0) {
    btn.style.display = 'none'
    if (window.atualizarContadores) window.atualizarContadores() // ← adicione
    return
  }

  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const qtd = carrinho.reduce((s, i) => s + i.quantidade, 0)

  document.getElementById('carrinho-qtd-badge').textContent = qtd
  document.getElementById('carrinho-total').textContent =
    'R$ ' + total.toFixed(2).replace('.', ',')

  btn.style.display = 'flex'
  if (window.atualizarContadores) window.atualizarContadores() // ← e aqui
  
  btn.classList.remove('pulsar')
  void btn.offsetWidth
  btn.classList.add('pulsar')
}

window.abrirCarrinho = function() {
  const carrinho = getCarrinho()
  const container = document.getElementById('carrinho-itens')
  container.innerHTML = ''

  if (carrinho.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px">Carrinho vazio</p>'
  } else {
    carrinho.forEach((item, index) => {
      const div = document.createElement('div')
      div.style.cssText = 'border-bottom:1px solid #f0f0f0;padding:12px 0;'

      const adicionaisTexto = item.adicionais && item.adicionais.length > 0
        ? item.adicionais.map(a => a.nome).join(', ')
        : ''

      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <p style="font-weight:600;font-size:14px">${item.quantidade}x ${item.nome}</p>
            ${adicionaisTexto ? `<p style="font-size:12px;color:#888;margin-top:2px">+ ${adicionaisTexto}</p>` : ''}
            ${item.observacao ? `<p style="font-size:12px;color:#888;margin-top:2px;font-style:italic">"${item.observacao}"</p>` : ''}
          </div>
          <div style="text-align:right;margin-left:12px">
            <p style="font-weight:700;color:#e63946">R$ ${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</p>
            <button onclick="removerItem(${index})"
              style="font-size:11px;color:#999;background:none;border:none;cursor:pointer;margin-top:4px">
              remover
            </button>
          </div>
        </div>
      `
      container.appendChild(div)
    })
  }

  atualizarTotalCarrinho()
  carregarRegioes()

  const overlay = document.getElementById('carrinho-overlay')
    overlay.classList.remove('hidden')
    setTimeout(() => overlay.classList.add('visivel'), 10)
    document.body.style.overflow = 'hidden'
}

window.fecharCarrinho = function(event) {
  if (event && event.target !== document.getElementById('carrinho-overlay')) return
  const overlay = document.getElementById('carrinho-overlay')
  overlay.classList.remove('visivel')
  setTimeout(() => {
    overlay.classList.add('hidden')
    document.body.style.overflow = ''
  }, 280)
}

window.removerItem = function(index) {
  const carrinho = getCarrinho()
  carrinho.splice(index, 1)
  localStorage.setItem('carrinho', JSON.stringify(carrinho))
  atualizarBotaoCarrinho()
  abrirCarrinho()
}

function atualizarTotalCarrinho() {
  const carrinho = getCarrinho()
  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const frete = parseFloat(document.getElementById('cliente-regiao').dataset.frete || 0)
  const total = subtotal + frete

  document.getElementById('total-final').textContent =
    'Total: R$ ' + total.toFixed(2).replace('.', ',')
}

async function carregarRegioes() {
  const { data: regioes } = await supabase
    .from('regioes_frete')
    .select('*')
    .eq('ativo', true)

  const select = document.getElementById('cliente-regiao')
  select.innerHTML = '<option value="">Selecione sua região</option>'

  regioes.forEach(r => {
    const opt = document.createElement('option')
    opt.value = r.id
    opt.textContent = `${r.nome} — R$ ${r.valor_frete.toFixed(2).replace('.', ',')} (${r.tempo_estimado})`
    opt.dataset.frete = r.valor_frete
    select.appendChild(opt)
  })

  select.onchange = function() {
    const option = this.options[this.selectedIndex]
    this.dataset.frete = option.dataset.frete || 0

    const frete = parseFloat(option.dataset.frete || 0)
    document.getElementById('frete-info').textContent = frete > 0
      ? 'Frete: R$ ' + frete.toFixed(2).replace('.', ',')
      : ''

    atualizarTotalCarrinho()
  }
}

// Aguarda o DOM carregar completamente antes de iniciar
document.addEventListener('DOMContentLoaded', () => {
  atualizarBotaoCarrinho()
})