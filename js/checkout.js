import { supabase } from './supabase.js'

window.finalizarPedido = async function() {
  const nome = document.getElementById('cliente-nome').value.trim()
  const whatsapp = document.getElementById('cliente-whatsapp').value.trim()
  const endereco = document.getElementById('cliente-endereco').value.trim()
  const regiaoSelect = document.getElementById('cliente-regiao')
  const regiaoNome = regiaoSelect.options[regiaoSelect.selectedIndex]?.text || ''
  const regiaoId = regiaoSelect.value
  const frete = parseFloat(regiaoSelect.dataset.frete || 0)

  // Validações
  if (!nome) return alert('Por favor, informe seu nome.')
  if (!whatsapp) return alert('Por favor, informe seu WhatsApp.')
  if (!endereco) return alert('Por favor, informe seu endereço.')
  if (!regiaoId) return alert('Por favor, selecione sua região.')

  const raw = JSON.parse(localStorage.getItem('carrinho') || '[]')
  const carrinho = Array.isArray(raw) ? raw : (Array.isArray(raw.carrinho) ? raw.carrinho : [])

  if (carrinho.length === 0) return alert('Seu carrinho está vazio.')

  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const total = subtotal + frete

  // Botão de loading
  const btn = document.getElementById('btn-finalizar')
  btn.textContent = 'Enviando...'
  btn.disabled = true

  // Salva pedido no Supabase
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      cliente_nome: nome,
      cliente_whatsapp: whatsapp,
      cliente_endereco: endereco,
      regiao_id: regiaoId,
      regiao_nome: regiaoNome,
      valor_frete: frete,
      subtotal: subtotal,
      total: total,
      itens: carrinho,
      status: 'pendente'
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao salvar pedido:', error)
    alert('Erro ao registrar pedido. Tente novamente.')
    btn.textContent = 'Finalizar pelo WhatsApp'
    btn.disabled = false
    return
  }

  // Monta a mensagem do WhatsApp
  let mensagem = `*Novo pedido* 🛒\n\n`
  mensagem += `*Cliente:* ${nome}\n`
  mensagem += `*WhatsApp:* ${whatsapp}\n`
  mensagem += `*Endereço:* ${endereco}\n`
  mensagem += `*Região:* ${regiaoNome}\n\n`
  mensagem += `*Itens do pedido:*\n`

  carrinho.forEach(item => {
    const itemTotal = item.preco * item.quantidade
    mensagem += `\n• ${item.quantidade}x *${item.nome}* — R$ ${itemTotal.toFixed(2).replace('.', ',')}`

    if (item.adicionais && item.adicionais.length > 0) {
      mensagem += `\n  _Adicionais: ${item.adicionais.map(a => a.nome).join(', ')}_`
    }

    if (item.observacao) {
      mensagem += `\n  _Obs: ${item.observacao}_`
    }
  })

  mensagem += `\n\n*Subtotal:* R$ ${subtotal.toFixed(2).replace('.', ',')}`
  mensagem += `\n*Frete:* R$ ${frete.toFixed(2).replace('.', ',')}`
  mensagem += `\n*Total:* R$ ${total.toFixed(2).replace('.', ',')}`
  mensagem += `\n\n_Pedido registrado com sucesso ✅_`

  // Abre WhatsApp do restaurante
  const whatsappRestaurante = window.whatsappRestaurante || '5500000000000'
  const url = `https://wa.me/${whatsappRestaurante}?text=${encodeURIComponent(mensagem)}`
  window.open(url, '_blank')

  // Limpa carrinho e fecha painel
  localStorage.setItem('carrinho', JSON.stringify([]))
  window.atualizarBotaoCarrinho()
  document.getElementById('carrinho-overlay').classList.add('hidden')
  document.body.style.overflow = ''

  btn.textContent = 'Finalizar pelo WhatsApp'
  btn.disabled = false

  // Salva o ID do pedido para o admin confirmar depois
  window._ultimoPedidoId = pedido.id
}