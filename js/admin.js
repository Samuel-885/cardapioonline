import { supabase } from './supabase.js'

// ==================== LOGIN ====================

window.fazerLogin = async function() {
  const email = document.getElementById('login-email').value.trim()
  const senha = document.getElementById('login-senha').value

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) {
    document.getElementById('login-erro').textContent = 'Email ou senha incorretos.'
    return
  }

  mostrarPainel()
}

window.sair = async function() {
  await supabase.auth.signOut()
  location.reload()
}

async function verificarSessao() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) mostrarPainel()
}

function mostrarPainel() {
  document.getElementById('tela-login').classList.add('hidden')
  document.getElementById('painel').classList.remove('hidden')
  iniciarNotificacoes()
  carregarPedidos('pendente')
}

// ==================== NAVEGAÇÃO ====================

window.mostrarAba = function(aba, btn) {
  document.querySelectorAll('.aba').forEach(a => a.classList.add('hidden'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('ativo'))
  document.getElementById('aba-' + aba).classList.remove('hidden')
  btn.classList.add('ativo')

  if (aba === 'pedidos') carregarPedidos('pendente')
  if (aba === 'produtos') carregarProdutos()
  if (aba === 'grupos') carregarGrupos()
  if (aba === 'categorias') carregarCategorias()
  if (aba === 'frete') carregarFrete()
  if (aba === 'config') carregarConfig()
}

// ==================== PEDIDOS ====================
// ==================== PEDIDOS ====================

let statusAtual = 'pendente'
let dataAtual = new Date().toISOString().split('T')[0]
let audioNotificacao = null
let ultimoPedidoId = null

function iniciarNotificacoes() {
  // Cria o áudio de notificação (beep simples via Web Audio API)
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return

  window._audioCtx = new AudioContext()

  // Toca um som de notificação
  window.tocarNotificacao = function() {
    const ctx = window._audioCtx
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.4)
  }

  // Verifica novos pedidos a cada 30 segundos
  setInterval(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('id')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(1)

    if (data && data.length > 0 && data[0].id !== ultimoPedidoId) {
      if (ultimoPedidoId !== null) {
        window.tocarNotificacao()
        document.title = '🔔 Novo pedido! — Admin'
        setTimeout(() => document.title = 'Painel Admin', 5000)
      }
      ultimoPedidoId = data[0].id
    }
  }, 30000)

  // Inicializa o ID atual para não tocar ao abrir
  supabase.from('pedidos').select('id').eq('status', 'pendente')
    .order('created_at', { ascending: false }).limit(1)
    .then(({ data }) => {
      ultimoPedidoId = data?.[0]?.id || null
    })
}

window.filtrarPedidos = function(status, btn) {
  statusAtual = status
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'))
  btn.classList.add('ativo')
  carregarPedidos(status)
}

window.limparFiltroData = function() {
  dataAtual = new Date().toISOString().split('T')[0]
  document.getElementById('input-data').value = dataAtual
  carregarPedidos(statusAtual)
}

async function carregarPedidos(status) {
  const inputData = document.getElementById('input-data')

  // Seta a data no input se ainda não estiver
  if (!inputData.value) inputData.value = dataAtual
  dataAtual = inputData.value

  // Início e fim do dia selecionado
  const inicioDia = new Date(dataAtual + 'T00:00:00-03:00').toISOString()
  const fimDia = new Date(dataAtual + 'T23:59:59-03:00').toISOString()

  let query = supabase
    .from('pedidos')
    .select('*')
    .gte('created_at', inicioDia)
    .lte('created_at', fimDia)
    .order('created_at', { ascending: false })

  if (status !== 'todos') query = query.eq('status', status)

  const { data: pedidos } = await query
  const lista = document.getElementById('lista-pedidos')
  lista.innerHTML = ''

  if (!pedidos || pedidos.length === 0) {
    lista.innerHTML = '<p style="color:#999;text-align:center;padding:40px">Nenhum pedido encontrado</p>'
    return
  }

  pedidos.forEach(pedido => {
    const data = new Date(pedido.created_at)
    const horario = data.toLocaleString('pt-BR')
    const itens = pedido.itens || []
    const resumoItens = itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')

    const badges = {
      pendente: '<span class="badge badge-pendente">Pendente</span>',
      preparando: '<span class="badge badge-preparando">Preparando</span>',
      confirmado: '<span class="badge badge-confirmado">Enviado</span>',
      cancelado: '<span class="badge badge-cancelado">Cancelado</span>'
    }

    const card = document.createElement('div')
    card.className = 'pedido-card'
    card.innerHTML = `
      <div class="pedido-header">
        <div>
          <p class="pedido-cliente">${pedido.cliente_nome}</p>
          <p class="pedido-horario">${horario}</p>
        </div>
        ${badges[pedido.status] || ''}
      </div>
      <div class="pedido-itens">
        <p>${resumoItens}</p>
        <p style="margin-top:4px;font-size:13px">📍 ${pedido.cliente_endereco} — ${pedido.regiao_nome}</p>
      </div>
      <p class="pedido-total">Total: R$ ${pedido.total.toFixed(2).replace('.', ',')}</p>
      <div class="pedido-acoes">
        ${pedido.status === 'pendente' ? `
          <button class="btn-confirmar" onclick="confirmarPedido('${pedido.id}', '${pedido.cliente_whatsapp}', '${pedido.cliente_nome}', ${pedido.total})">
            Confirmar e avisar cliente
          </button>
          <button class="btn-cancelar" onclick="cancelarPedido('${pedido.id}')">Cancelar</button>
        ` : ''}
        ${pedido.status === 'preparando' ? `
          <button class="btn-confirmar" onclick="enviarPedido('${pedido.id}')">
            Marcar como enviado
          </button>
          <button class="btn-cancelar" onclick="cancelarPedido('${pedido.id}')">Cancelar</button>
        ` : ''}
        ${pedido.status === 'confirmado' ? `
          <button class="btn-cancelar" onclick="cancelarPedido('${pedido.id}')">Cancelar pedido</button>
        ` : ''}
        <button class="btn-editar" onclick="verDetalhesPedido('${pedido.id}')">Ver detalhes</button>
      </div>
    `
    lista.appendChild(card)
  })

  // Listener para mudança de data
  inputData.onchange = () => carregarPedidos(statusAtual)
}

window.confirmarPedido = async function(id, whatsappCliente, nomeCliente, total) {
  await supabase.from('pedidos').update({ status: 'preparando' }).eq('id', id)

  const mensagem = `Olá ${nomeCliente}! 😊\n\nSeu pedido foi *confirmado* e já está sendo preparado!\n\n*Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\nQualquer dúvida é só chamar. Obrigado pela preferência! 🍔`
  const url = `https://wa.me/55${whatsappCliente.replace(/\D/g,'')}?text=${encodeURIComponent(mensagem)}`
  window.open(url, '_blank')

  carregarPedidos(statusAtual)
}

window.enviarPedido = async function(id) {
  await supabase.from('pedidos').update({ status: 'confirmado' }).eq('id', id)
  carregarPedidos(statusAtual)
}

window.cancelarPedido = async function(id) {
  if (!confirm('Cancelar este pedido?')) return
  await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', id)
  carregarPedidos(statusAtual)
}

window.verDetalhesPedido = function(id) {
  supabase.from('pedidos').select('*').eq('id', id).single().then(({ data }) => {
    if (!data) return
    const itens = data.itens.map(i => {
      let linha = `• ${i.quantidade}x ${i.nome} — R$ ${(i.preco * i.quantidade).toFixed(2).replace('.', ',')}`
      if (i.adicionais?.length) linha += `\n  + ${i.adicionais.map(a => a.nome).join(', ')}`
      if (i.observacao) linha += `\n  Obs: ${i.observacao}`
      return linha
    }).join('\n')

    document.getElementById('modal-admin-conteudo').innerHTML = `
      <h3>Pedido de ${data.cliente_nome}</h3>
      <p style="color:#888;font-size:13px;margin-bottom:16px">${new Date(data.created_at).toLocaleString('pt-BR')}</p>
      <p><strong>WhatsApp:</strong> ${data.cliente_whatsapp}</p>
      <p><strong>Endereço:</strong> ${data.cliente_endereco}</p>
      <p><strong>Região:</strong> ${data.regiao_nome}</p>
      <pre style="background:#f5f5f5;padding:14px;border-radius:8px;margin-top:14px;font-size:13px;white-space:pre-wrap">${itens}</pre>
      <p style="margin-top:12px"><strong>Subtotal:</strong> R$ ${data.subtotal.toFixed(2).replace('.', ',')}</p>
      <p><strong>Frete:</strong> R$ ${data.valor_frete.toFixed(2).replace('.', ',')}</p>
      <p style="font-size:18px;font-weight:700;color:#e63946;margin-top:8px">Total: R$ ${data.total.toFixed(2).replace('.', ',')}</p>
    `
    document.getElementById('modal-admin-overlay').classList.remove('hidden')
  })
}

window.fecharModalAdmin = function(event) {
  if (event && event.target !== document.getElementById('modal-admin-overlay')) return
  document.getElementById('modal-admin-overlay').classList.add('hidden')
}

// ==================== GRUPOS DE ADICIONAIS ====================

async function carregarGrupos() {
  const { data: grupos } = await supabase.from('grupos_adicionais').select('*, itens_grupo_adicional(*)')
  const lista = document.getElementById('lista-grupos')
  lista.innerHTML = ''

  if (!grupos || grupos.length === 0) {
    lista.innerHTML = '<p style="color:#999;text-align:center;padding:40px">Nenhum grupo criado ainda</p>'
    return
  }

  grupos.forEach(g => {
    const itens = g.itens_grupo_adicional || []
    const div = document.createElement('div')
    div.className = 'item-linha'
    div.style.alignItems = 'flex-start'
    div.innerHTML = `
      <div class="item-linha-info" style="flex:1">
        <p class="item-linha-nome">${g.nome}</p>
        <p class="item-linha-detalhe">${itens.length} itens: ${itens.map(i => i.nome).join(', ') || '—'}</p>
      </div>
      <div class="item-acoes">
        <button class="btn-editar" onclick="abrirFormGrupo('${g.id}')">Editar</button>
        <button class="btn-deletar" onclick="deletarGrupo('${g.id}')">Excluir</button>
      </div>
    `
    lista.appendChild(div)
  })
}

window.abrirFormGrupo = async function(id = null) {
  let grupo = { nome: '' }
  let itens = []

  if (id) {
    const { data } = await supabase.from('grupos_adicionais').select('*, itens_grupo_adicional(*)').eq('id', id).single()
    grupo = data
    itens = data.itens_grupo_adicional || []
  }

  window._itensGrupoForm = itens.map(i => ({ ...i }))

  const itensHtml = () => window._itensGrupoForm.map((item, i) => `
    <div id="ig-${i}" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <input type="text" placeholder="Nome do adicional" value="${item.nome}"
        style="flex:2" oninput="window._itensGrupoForm[${i}].nome=this.value" />
      <input type="number" placeholder="Preço" value="${item.preco}"
        style="flex:1" oninput="window._itensGrupoForm[${i}].preco=parseFloat(this.value)||0" />
      <button type="button" onclick="removerItemGrupo(${i})"
        style="background:#fee;border:1px solid #fcc;color:#c00;border-radius:6px;padding:6px 10px;cursor:pointer">✕</button>
    </div>
  `).join('')

  document.getElementById('modal-admin-conteudo').innerHTML = `
    <h3>${id ? 'Editar grupo' : 'Novo grupo de adicionais'}</h3>
    <label>Nome do grupo</label>
    <input type="text" id="g-nome" value="${grupo.nome}" placeholder="Ex: Adicionais Hambúrguer" />
    <label style="margin-top:16px">Itens do grupo</label>
    <div id="form-itens-grupo">${itensHtml()}</div>
    <button type="button" onclick="adicionarItemGrupo()"
      style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px;margin-top:4px">
      + Adicionar item
    </button>
    <button class="btn-salvar" onclick="salvarGrupo('${id || ''}')">Salvar grupo</button>
  `

  document.getElementById('modal-admin-overlay').classList.remove('hidden')
}

window.adicionarItemGrupo = function() {
  window._itensGrupoForm.push({ nome: '', preco: 0 })
  const i = window._itensGrupoForm.length - 1
  const div = document.createElement('div')
  div.id = `ig-${i}`
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center'
  div.innerHTML = `
    <input type="text" placeholder="Nome do adicional" style="flex:2"
      oninput="window._itensGrupoForm[${i}].nome=this.value" />
    <input type="number" placeholder="Preço" style="flex:1"
      oninput="window._itensGrupoForm[${i}].preco=parseFloat(this.value)||0" />
    <button type="button" onclick="removerItemGrupo(${i})"
      style="background:#fee;border:1px solid #fcc;color:#c00;border-radius:6px;padding:6px 10px;cursor:pointer">✕</button>
  `
  document.getElementById('form-itens-grupo').appendChild(div)
}

window.removerItemGrupo = function(i) {
  window._itensGrupoForm[i] = null
  const el = document.getElementById(`ig-${i}`)
  if (el) el.remove()
}

window.salvarGrupo = async function(id) {
  const nome = document.getElementById('g-nome').value.trim()
  if (!nome) return alert('Informe o nome do grupo.')

  let grupoId = id

  if (id) {
    await supabase.from('grupos_adicionais').update({ nome }).eq('id', id)
    await supabase.from('itens_grupo_adicional').delete().eq('grupo_id', id)
  } else {
    const { data } = await supabase.from('grupos_adicionais').insert({ nome }).select().single()
    grupoId = data.id
  }

  const itensValidos = (window._itensGrupoForm || []).filter(i => i && i.nome.trim())
  if (itensValidos.length > 0) {
    await supabase.from('itens_grupo_adicional').insert(
      itensValidos.map(i => ({ grupo_id: grupoId, nome: i.nome.trim(), preco: i.preco || 0 }))
    )
  }

  document.getElementById('modal-admin-overlay').classList.add('hidden')
  carregarGrupos()
}

window.deletarGrupo = async function(id) {
  if (!confirm('Excluir este grupo? Os produtos vinculados perderão esses adicionais.')) return
  await supabase.from('grupos_adicionais').delete().eq('id', id)
  carregarGrupos()
}

// ==================== PRODUTOS ====================

async function carregarProdutos() {
  const { data } = await supabase.from('produtos').select('*, categorias(nome)').order('ordem')
  const lista = document.getElementById('lista-produtos')
  lista.innerHTML = ''

  data?.forEach(p => {
    const div = document.createElement('div')
    div.className = 'item-linha'
    div.innerHTML = `
      <div class="item-linha-info">
        <p class="item-linha-nome">${p.nome} ${!p.ativo ? '<span style="color:#999;font-size:12px">(inativo)</span>' : ''}</p>
        <p class="item-linha-detalhe">R$ ${p.preco.toFixed(2).replace('.', ',')} · ${p.categorias?.nome || 'Sem categoria'}</p>
      </div>
      <div class="item-acoes">
        <button class="btn-editar" onclick="abrirFormProduto('${p.id}')">Editar</button>
        <button class="btn-deletar" onclick="deletarProduto('${p.id}')">Excluir</button>
      </div>
    `
    lista.appendChild(div)
  })
}

window.abrirFormProduto = async function(id = null) {
  const { data: cats } = await supabase.from('categorias').select('*').order('ordem')
  const { data: grupos } = await supabase.from('grupos_adicionais').select('*')

  const opsCats = cats.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')

  let produto = { nome: '', descricao: '', preco: '', preco_promocional: '', categoria_id: '', ativo: true, ordem: 0, imagem_url: '' }
  let gruposVinculados = []

  if (id) {
    const { data } = await supabase.from('produtos').select('*').eq('id', id).single()
    produto = data
    const { data: pgs } = await supabase.from('produto_grupos').select('grupo_id').eq('produto_id', id)
    gruposVinculados = (pgs || []).map(pg => pg.grupo_id)
  }

  const gruposHtml = grupos.map(g => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:400">
      <input type="checkbox" value="${g.id}" ${gruposVinculados.includes(g.id) ? 'checked' : ''}
        style="width:auto" />
      ${g.nome}
    </label>
  `).join('')

  document.getElementById('modal-admin-conteudo').innerHTML = `
    <h3>${id ? 'Editar produto' : 'Novo produto'}</h3>

    <label>Nome</label>
    <input type="text" id="p-nome" value="${produto.nome}" />

    <label>Descrição</label>
    <input type="text" id="p-desc" value="${produto.descricao || ''}" />

    <label>Categoria</label>
    <select id="p-cat">${opsCats}</select>

    <label>Preço (R$)</label>
    <input type="number" id="p-preco" value="${produto.preco}" step="0.01" />

    <label>Preço promocional (deixe vazio se não tiver)</label>
    <input type="number" id="p-promo" value="${produto.preco_promocional || ''}" step="0.01" />

    <label>Ordem de exibição</label>
    <input type="number" id="p-ordem" value="${produto.ordem || 0}" />

    <label>Imagem do produto</label>
    ${produto.imagem_url ? `<img src="${produto.imagem_url}" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-bottom:8px" />` : ''}
    <input type="file" id="p-imagem" accept="image/*"
      style="border:1px dashed #ddd;padding:10px;border-radius:8px;cursor:pointer" />
    <p id="upload-status" style="font-size:12px;color:#888;margin-top:4px"></p>

    <label style="margin-top:16px">
      <input type="checkbox" id="p-ativo" ${produto.ativo ? 'checked' : ''} style="width:auto;margin-right:6px" />
      Produto ativo (visível no cardápio)
    </label>

    <label style="margin-top:16px">Grupos de adicionais</label>
    ${grupos.length === 0
      ? '<p style="color:#999;font-size:13px">Nenhum grupo criado ainda. Crie grupos na aba "Grupos de Adicionais".</p>'
      : `<div id="grupos-checkboxes">${gruposHtml}</div>`
    }

    <button class="btn-salvar" onclick="salvarProduto('${id || ''}')">Salvar produto</button>
  `

  if (produto.categoria_id) {
    document.getElementById('p-cat').value = produto.categoria_id
  }

  document.getElementById('modal-admin-overlay').classList.remove('hidden')
}

window.salvarProduto = async function(id) {
  const nome = document.getElementById('p-nome').value.trim()
  const preco = parseFloat(document.getElementById('p-preco').value)

  if (!nome || !preco) return alert('Nome e preço são obrigatórios.')

  const statusEl = document.getElementById('upload-status')
  let imagem_url = null

  // Upload de imagem
  const fileInput = document.getElementById('p-imagem')
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0]
    const ext = file.name.split('.').pop()
    const path = `produtos/${Date.now()}.${ext}`
    statusEl.textContent = 'Enviando imagem...'

    const { error: uploadError } = await supabase.storage.from('imagens').upload(path, file)
    if (uploadError) {
      statusEl.textContent = 'Erro no upload da imagem.'
      return
    }

    const { data: urlData } = supabase.storage.from('imagens').getPublicUrl(path)
    imagem_url = urlData.publicUrl
    statusEl.textContent = 'Imagem enviada!'
  }

  const dados = {
    nome,
    descricao: document.getElementById('p-desc').value.trim(),
    categoria_id: document.getElementById('p-cat').value,
    preco,
    preco_promocional: document.getElementById('p-promo').value
      ? parseFloat(document.getElementById('p-promo').value) : null,
    ordem: parseInt(document.getElementById('p-ordem').value) || 0,
    ativo: document.getElementById('p-ativo').checked,
    ...(imagem_url && { imagem_url })
  }

  let produtoId = id

  if (id) {
    await supabase.from('produtos').update(dados).eq('id', id)
  } else {
    const { data } = await supabase.from('produtos').insert(dados).select().single()
    produtoId = data.id
  }

  // Salva vínculos com grupos
  await supabase.from('produto_grupos').delete().eq('produto_id', produtoId)
  const checkboxes = document.querySelectorAll('#grupos-checkboxes input:checked')
  if (checkboxes.length > 0) {
    await supabase.from('produto_grupos').insert(
      Array.from(checkboxes).map(cb => ({ produto_id: produtoId, grupo_id: cb.value }))
    )
  }

  document.getElementById('modal-admin-overlay').classList.add('hidden')
  carregarProdutos()
}

window.deletarProduto = async function(id) {
  if (!confirm('Excluir este produto?')) return
  await supabase.from('produtos').delete().eq('id', id)
  carregarProdutos()
}

// ==================== CATEGORIAS ====================

async function carregarCategorias() {
  const { data } = await supabase.from('categorias').select('*').order('ordem')
  const lista = document.getElementById('lista-categorias')
  lista.innerHTML = ''

  data?.forEach(c => {
    const div = document.createElement('div')
    div.className = 'item-linha'
    div.innerHTML = `
      <div class="item-linha-info">
        <p class="item-linha-nome">${c.nome}</p>
        <p class="item-linha-detalhe">Ordem: ${c.ordem}</p>
      </div>
      <div class="item-acoes">
        <button class="btn-editar" onclick="abrirFormCategoria('${c.id}')">Editar</button>
        <button class="btn-deletar" onclick="deletarCategoria('${c.id}')">Excluir</button>
      </div>
    `
    lista.appendChild(div)
  })
}

window.abrirFormCategoria = async function(id = null) {
  let cat = { nome: '', ordem: 0 }
  if (id) {
    const { data } = await supabase.from('categorias').select('*').eq('id', id).single()
    cat = data
  }

  document.getElementById('modal-admin-conteudo').innerHTML = `
    <h3>${id ? 'Editar categoria' : 'Nova categoria'}</h3>
    <label>Nome</label>
    <input type="text" id="c-nome" value="${cat.nome}" />
    <label>Ordem de exibição</label>
    <input type="number" id="c-ordem" value="${cat.ordem}" />
    <button class="btn-salvar" onclick="salvarCategoria('${id || ''}')">Salvar</button>
  `
  document.getElementById('modal-admin-overlay').classList.remove('hidden')
}

window.salvarCategoria = async function(id) {
  const dados = {
    nome: document.getElementById('c-nome').value.trim(),
    ordem: parseInt(document.getElementById('c-ordem').value) || 0
  }
  if (!dados.nome) return alert('Informe o nome da categoria.')
  if (id) {
    await supabase.from('categorias').update(dados).eq('id', id)
  } else {
    await supabase.from('categorias').insert(dados)
  }
  document.getElementById('modal-admin-overlay').classList.add('hidden')
  carregarCategorias()
}

window.deletarCategoria = async function(id) {
  if (!confirm('Excluir esta categoria?')) return
  await supabase.from('categorias').delete().eq('id', id)
  carregarCategorias()
}

// ==================== FRETE ====================

async function carregarFrete() {
  const { data } = await supabase.from('regioes_frete').select('*').order('nome')
  const lista = document.getElementById('lista-frete')
  lista.innerHTML = ''

  data?.forEach(r => {
    const div = document.createElement('div')
    div.className = 'item-linha'
    div.innerHTML = `
      <div class="item-linha-info">
        <p class="item-linha-nome">${r.nome} ${!r.ativo ? '<span style="color:#999;font-size:12px">(inativa)</span>' : ''}</p>
        <p class="item-linha-detalhe">R$ ${r.valor_frete.toFixed(2).replace('.', ',')} · ${r.tempo_estimado || ''}</p>
      </div>
      <div class="item-acoes">
        <button class="btn-editar" onclick="abrirFormFrete('${r.id}')">Editar</button>
        <button class="btn-deletar" onclick="deletarFrete('${r.id}')">Excluir</button>
      </div>
    `
    lista.appendChild(div)
  })
}

window.abrirFormFrete = async function(id = null) {
  let r = { nome: '', valor_frete: '', tempo_estimado: '', ativo: true }
  if (id) {
    const { data } = await supabase.from('regioes_frete').select('*').eq('id', id).single()
    r = data
  }

  document.getElementById('modal-admin-conteudo').innerHTML = `
    <h3>${id ? 'Editar região' : 'Nova região'}</h3>
    <label>Nome da região</label>
    <input type="text" id="f-nome" value="${r.nome}" />
    <label>Valor do frete (R$)</label>
    <input type="number" id="f-valor" value="${r.valor_frete}" step="0.01" />
    <label>Tempo estimado</label>
    <input type="text" id="f-tempo" value="${r.tempo_estimado || ''}" placeholder="Ex: 30–45 min" />
    <label>
      <input type="checkbox" id="f-ativo" ${r.ativo ? 'checked' : ''} style="width:auto;margin-right:6px" />
      Região ativa
    </label>
    <button class="btn-salvar" onclick="salvarFrete('${id || ''}')">Salvar</button>
  `
  document.getElementById('modal-admin-overlay').classList.remove('hidden')
}

window.salvarFrete = async function(id) {
  const dados = {
    nome: document.getElementById('f-nome').value.trim(),
    valor_frete: parseFloat(document.getElementById('f-valor').value) || 0,
    tempo_estimado: document.getElementById('f-tempo').value.trim(),
    ativo: document.getElementById('f-ativo').checked
  }
  if (!dados.nome) return alert('Informe o nome da região.')
  if (id) {
    await supabase.from('regioes_frete').update(dados).eq('id', id)
  } else {
    await supabase.from('regioes_frete').insert(dados)
  }
  document.getElementById('modal-admin-overlay').classList.add('hidden')
  carregarFrete()
}

window.deletarFrete = async function(id) {
  if (!confirm('Excluir esta região?')) return
  await supabase.from('regioes_frete').delete().eq('id', id)
  carregarFrete()
}

// ==================== CONFIG ====================

async function carregarConfig() {
  const { data } = await supabase.from('config').select('*').single()
  if (!data) return
  document.getElementById('config-nome').value = data.nome || ''
  document.getElementById('config-whatsapp').value = data.whatsapp || ''
  document.getElementById('config-horario').value = data.horario || ''
  document.getElementById('config-mensagem').value = data.mensagem_boas_vindas || ''
  document.getElementById('config-logo').value = data.logo_url || ''
}

window.salvarConfig = async function() {
  const dados = {
    nome: document.getElementById('config-nome').value.trim(),
    whatsapp: document.getElementById('config-whatsapp').value.trim(),
    horario: document.getElementById('config-horario').value.trim(),
    mensagem_boas_vindas: document.getElementById('config-mensagem').value.trim(),
    logo_url: document.getElementById('config-logo').value.trim()
  }
  await supabase.from('config').update(dados).eq('id', 1)
  document.getElementById('config-feedback').textContent = 'Salvo com sucesso!'
  setTimeout(() => document.getElementById('config-feedback').textContent = '', 3000)
}

// ==================== INIT ====================
verificarSessao()