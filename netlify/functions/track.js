/**
 * ═══════════════════════════════════════════════════════════
 *  Pegaki — track.js  |  Netlify Function
 *  Responsável por: timeline, status, mensagens, gênero
 * ═══════════════════════════════════════════════════════════
 *
 *  📌 COMO EDITAR ESTE ARQUIVO:
 *  - Mensagens do chatbot → seção MENSAGENS PERSONALIZADAS
 *  - Etapas da timeline   → seção ETAPAS DA TIMELINE
 *  - Explicação do HUB    → seção MENSAGENS PERSONALIZADAS > hub
 *  - Nomes femininos      → seção DETECÇÃO DE GÊNERO
 *  - Novas transportadoras → seção FONTES FUTURAS
 * ═══════════════════════════════════════════════════════════
 */

"use strict";

const https = require("https");
const http  = require("http");

// ─────────────────────────────────────────────────────────────
//  CORS
// ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type":                 "application/json; charset=utf-8",
};


// ═══════════════════════════════════════════════════════════
//  ETAPAS DA TIMELINE
//  📝 Para editar: mude label, icone ou descricao de cada etapa
//  📝 Para adicionar etapa: copie um bloco e ajuste o id/ordem
// ═══════════════════════════════════════════════════════════
const ETAPAS = [
  {
    id:          "postado",
    ordem:       1,
    label:       "Postado no ponto Pegaki",
    icone:       "📦",
    cor:         "postado",
    responsavel: "pegaki",
    descricao:   "Pacote recebido com sucesso em um ponto parceiro Pegaki.",
  },
  {
    id:          "coletado",
    ordem:       2,
    label:       "Coletado pela Pegaki",
    icone:       "🚚",
    cor:         "coletado",
    responsavel: "pegaki",
    descricao:   "Pacote coletado no ponto e em deslocamento para o HUB.",
  },
  {
    id:          "hub_entrada",
    ordem:       3,
    label:       "Chegou ao Centro Logístico (HUB)",
    icone:       "🏢",
    cor:         "hub",
    responsavel: "pegaki",
    descricao:   "HUB = local onde os pacotes são organizados e preparados para envio.",
  },
  {
    id:          "hub_unitizado",
    ordem:       4,
    label:       "Preparado para envio",
    icone:       "✅",
    cor:         "hub",
    responsavel: "pegaki",
    descricao:   "Pacote separado, conferido e pronto para despacho à transportadora.",
  },
  {
    id:          "saiu_hub",
    ordem:       5,
    label:       "Saiu com a transportadora",
    icone:       "🎉",
    cor:         "transportadora",
    responsavel: "transportadora",
    descricao:   "Pacote coletado pela transportadora. Acompanhe pela plataforma emissora.",
  },
  {
    id:          "em_transito",
    ordem:       6,
    label:       "Em trânsito",
    icone:       "🛣️",
    cor:         "transito",
    responsavel: "transportadora",
    descricao:   "Pacote em rota com a transportadora responsável.",
  },
  {
    id:          "saiu_entrega",
    ordem:       7,
    label:       "Saiu para entrega",
    icone:       "🏃",
    cor:         "entrega",
    responsavel: "transportadora",
    descricao:   "Entregador a caminho do endereço de entrega.",
  },
  {
    id:          "entregue",
    ordem:       8,
    label:       "Entregue ao destinatário",
    icone:       "🎊",
    cor:         "entregue",
    responsavel: "transportadora",
    descricao:   "Entrega realizada com sucesso.",
  },
];


// ═══════════════════════════════════════════════════════════
//  MENSAGENS PERSONALIZADAS
//  📝 Edite os textos abaixo sem medo — não afeta a lógica
//  📝 Use ${nome} para inserir o nome da pessoa
//  📝 Use <br> para quebrar linha (é HTML)
// ═══════════════════════════════════════════════════════════
const MENSAGENS = {

  // ── Saudação por gênero ─────────────────────────────────
  // 📝 Edite aqui o texto de boas-vindas para cada gênero
  bemVindaFeminino: (nome) =>
    `Bem-vinda, <strong>${nome}</strong> 💜`,

  bemVindoMasculino: (nome) =>
    `Bem-vindo, <strong>${nome}</strong>!`,

  bemVindoNeutro: (nome) =>
    `Bem-vindo(a), <strong>${nome}</strong>!`,

  // ── Mensagem: Postado no ponto ───────────────────────────
  // 📝 Edite aqui o texto exibido quando status = postado
  postado: (nome) => `
    📦 <strong>POSTADO NO PONTO PEGAKI</strong><br><br>
    Boa notícia, <strong>${nome}</strong>! Seu pacote foi recebido com sucesso em um <strong>ponto parceiro Pegaki</strong>.<br><br>
    O que acontece agora:<br>
    • O ponto registra o pacote no sistema<br>
    • Nossa equipe passa para coletar em breve<br><br>
    ⏱ Tempo médio até a coleta: <strong>1 a 2 dias úteis</strong>.`,

  // ── Mensagem: Coletado ───────────────────────────────────
  // 📝 Edite aqui o texto exibido quando status = coletado
  coletado: (nome) => `
    🚚 <strong>COLETADO PELA PEGAKI!</strong><br><br>
    <strong>${nome}</strong>, a equipe Pegaki já coletou seu pacote e está levando ao nosso <strong>Centro Logístico (HUB)</strong>.<br><br>
    💡 <em>HUB = Centro Logístico da Pegaki, onde os pacotes são organizados, separados e preparados para envio às transportadoras responsáveis pela entrega final.</em>`,

  // ── Mensagem: Chegou ao HUB ──────────────────────────────
  // 📝 Edite aqui o texto exibido quando status = hub_entrada
  hub_entrada: (nome) => `
    🏢 <strong>CHEGOU AO CENTRO LOGÍSTICO (HUB)!</strong><br><br>
    <strong>${nome}</strong>, seu pacote chegou ao HUB da Pegaki e está passando pelo processo de triagem.<br><br>
    O que fazemos aqui:<br>
    • Conferência do pacote e da etiqueta<br>
    • Organização por destino e transportadora<br>
    • Preparação para a coleta pela transportadora final<br><br>
    💡 <em>HUB = Centro Logístico da Pegaki, onde os pacotes são organizados, separados e preparados para envio às transportadoras responsáveis pela entrega final.</em>`,

  // ── Mensagem: Preparado no HUB ──────────────────────────
  // 📝 Edite aqui o texto exibido quando status = hub_unitizado
  hub_unitizado: (nome) => `
    ✅ <strong>PREPARADO PARA ENVIO!</strong><br><br>
    <strong>${nome}</strong>, seu pacote foi <strong>unitizado</strong> no HUB — separado, conferido e preparado para despacho.<br><br>
    💡 <em>Unitizado = pacote organizado, etiquetado e pronto para ser coletado pela transportadora responsável pela entrega.</em><br><br>
    Em breve a transportadora realizará a coleta!`,

  // ── Mensagem: Saiu com a transportadora ─────────────────
  // 📝 Edite aqui o texto exibido quando status = saiu_hub
  // 📝 Esta é a mensagem mais importante — personalize com cuidado
  saiu_hub: (nome) => `
    🎉 <strong>SAIU DO HUB — COM A TRANSPORTADORA!</strong><br><br>
    <strong>${nome}</strong>, seu pacote já foi coletado pela transportadora responsável pela entrega ao destinatário final. 🚚<br><br>
    A partir desta etapa, a Pegaki não realiza mais o acompanhamento do rastreio, pois nossa operação acompanha o pedido apenas até a saída do HUB (Centro Logístico).<br><br>
    <strong>A Pegaki é responsável por:</strong><br>
    • Receber o pacote no ponto parceiro<br>
    • Realizar a coleta<br>
    • Encaminhar ao HUB<br>
    • Fazer a separação e preparação logística<br>
    • Entregar à transportadora responsável pela entrega final<br><br>
    ⚠️ <strong>Importante:</strong><br>
    Caso o rastreio não apresente novas atualizações após a coleta pela transportadora, recomendamos entrar em contato diretamente com a plataforma responsável pela emissão da etiqueta ou com a própria transportadora.`,

  // ── Mensagem: Em trânsito ────────────────────────────────
  // 📝 Edite aqui o texto exibido quando status = em_transito
  em_transito: (nome) => `
    🛣️ <strong>EM TRÂNSITO!</strong><br><br>
    <strong>${nome}</strong>, seu pacote está em rota com a transportadora responsável.<br><br>
    Para acompanhar a entrega final, acesse a plataforma que emitiu a etiqueta do pedido.`,

  // ── Mensagem: Saiu para entrega ──────────────────────────
  // 📝 Edite aqui o texto exibido quando status = saiu_entrega
  saiu_entrega: (nome) => `
    🏃 <strong>SAIU PARA ENTREGA!</strong><br><br>
    <strong>${nome}</strong>, ótima notícia! O entregador já está a caminho do endereço de entrega.<br><br>
    Fique de olho — a entrega deve acontecer hoje! 📍`,

  // ── Mensagem: Entregue ───────────────────────────────────
  // 📝 Edite aqui o texto exibido quando status = entregue
  entregue: (nome) => `
    🎊 <strong>ENTREGUE AO DESTINATÁRIO!</strong><br><br>
    Parabéns, <strong>${nome}</strong>! Seu pacote foi entregue com sucesso ao destinatário final. 💜<br><br>
    Esperamos que tudo tenha chegado em perfeito estado.<br>
    Em caso de dúvidas sobre o produto, entre em contato com a plataforma de compra.`,

  // ── Mensagem: Pacote parado ──────────────────────────────
  // 📝 Edite aqui o alerta de pacote sem movimentação há +2 dias
  parado: (nome, codigo) => `
    ⚠️ <strong>Atenção, ${nome}!</strong><br><br>
    Seu pedido está com status <em>postado</em> há mais de 2 dias sem movimentação.<br><br>
    Recomendamos abrir um chamado pelo e-mail <a href="mailto:ajuda@pegaki.com.br">ajuda@pegaki.com.br</a> informando o código <strong>${codigo}</strong>.`,

  // ── Mensagem: Não encontrado ─────────────────────────────
  // 📝 Edite aqui o texto quando o código não for localizado
  naoEncontrado: (codigo) => `
    ❌ <strong>Código não localizado</strong><br><br>
    Não encontrei informações para o código <strong>${codigo}</strong>.<br><br>
    Verifique se o código foi digitado corretamente ou entre em contato: <a href="mailto:ajuda@pegaki.com.br">ajuda@pegaki.com.br</a>`,

};


// ═══════════════════════════════════════════════════════════
//  DETECÇÃO DE GÊNERO
//  📝 Adicione nomes femininos à lista abaixo conforme necessário
//  📝 Todos em minúsculas, separados por vírgula
// ═══════════════════════════════════════════════════════════
const NOMES_FEMININOS = new Set([
  "ana","beatriz","bruna","camila","carla","carolina","claudia",
  "cristina","daniela","débora","debora","eduarda","elaine","elisa",
  "fernanda","gabriela","giovana","isabela","isabel","jessica","jéssica",
  "juliana","julia","júlia","karen","karina","larissa","laura","leticia",
  "letícia","lilian","luana","lucia","lúcia","luiza","marcia","márcia",
  "mariana","marina","melissa","michelle","milena","natalia","natália",
  "nicole","patricia","patrícia","paula","priscila","rafaela","rebeca",
  "regina","renata","sabrina","sandra","silvana","simone","sofia","stella",
  "suelen","tainara","tamires","tatiana","thais","thaís","thalia","valeria",
  "valéria","vanessa","veronica","vitoria","vitória","yasmin","andrezza",
  "andreza","andrea","andréa","amanda","alice","aline","alana","adriana",
  "alessandra","angelica","angélica","bárbara","barbara","bianca",
]);

function detectarGenero(nome) {
  const n = (nome || "").toLowerCase().trim().split(" ")[0];
  if (NOMES_FEMININOS.has(n)) return "f";
  // Heurística: termina em 'a' provavelmente feminino
  if (n.endsWith("a") && n.length > 3) return "f";
  return "m";
}


// ═══════════════════════════════════════════════════════════
//  FONTES FUTURAS DE RASTREAMENTO
//  📝 Adicione novas transportadoras aqui no futuro
//  📝 Exemplo: correios, melhorenvio, frenet, nuvemshop
// ═══════════════════════════════════════════════════════════
// const FONTES = {
//   correios:    (codigo) => `https://.../${codigo}`,
//   melhorenvio: (codigo) => `https://.../${codigo}`,
//   frenet:      (codigo) => `https://.../${codigo}`,
// };


// ─────────────────────────────────────────────────────────────
//  HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return respJson(405, { ok: false, erro: "Método não permitido" });
  }

  const params = event.queryStringParameters || {};
  const codigo = (params.codigo || "").trim().replace(/\s+/g, "").toUpperCase();
  const nome   = (params.nome   || "").trim();

  if (!codigo || codigo.length < 5) {
    return respJson(400, { ok: false, erro: "Informe um código de rastreio válido." });
  }

  const genero    = detectarGenero(nome);
  const saudacao  = genero === "f"
    ? MENSAGENS.bemVindaFeminino(nome)
    : MENSAGENS.bemVindoMasculino(nome);

  // Detecta tipo de código
  const isCorreios = /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(codigo);

  // Tenta API dos Correios se formato correto
  if (isCorreios) {
    try {
      const real = await buscarCorreios(codigo);
      if (real) {
        return respJson(200, {
          ...real,
          genero,
          saudacao,
          mensagem: MENSAGENS[real.etapaAtual?.id]?.(nome) || null,
          mensagemParado: real.parado ? MENSAGENS.parado(nome, codigo) : null,
        });
      }
    } catch (_) {}
  }

  // Fallback: timeline Pegaki estimada — nunca retorna erro
  const fallback = gerarTimelinePegaki(codigo);
  return respJson(200, {
    ...fallback,
    genero,
    saudacao,
    mensagem: MENSAGENS[fallback.etapaAtual?.id]?.(nome) || null,
    mensagemParado: null,
  });
};


// ─────────────────────────────────────────────────────────────
//  BUSCA CORREIOS
// ─────────────────────────────────────────────────────────────
async function buscarCorreios(codigo) {
  const url = `https://proxyapp.correios.com.br/v1/sro-rastro/${codigo}`;
  const raw = await getJson(url, 7000);
  if (!raw || raw.msgs || raw.mensagem) return null;

  const obj   = Array.isArray(raw.objetos) ? raw.objetos[0] : raw;
  const evRaw = obj?.eventos || obj?.evento || [];
  if (!evRaw.length) return null;

  const eventos = evRaw.map(ev => ({
    etapaId:        mapearCorreios(ev.descricao || ev.tipo || ""),
    descricao:      ev.descricao || ev.tipo || "",
    data:           fmtData(ev.dtHrCriado || ev.data || null),
    local:          buildLocal(ev.unidade || ev.origem),
    transportadora: "Correios",
  }));

  eventos.sort((a, b) => ordemEtapa(b.etapaId) - ordemEtapa(a.etapaId));
  const etapaAtual = ETAPAS.find(e => e.id === eventos[0]?.etapaId) || ETAPAS[4];

  return {
    ok: true, codigo, encontrado: true,
    tipo: "correios", real: true,
    etapaAtual, parado: detectarParado(eventos),
    eventos, etapas: ETAPAS,
    transportadora: "Correios",
  };
}

function mapearCorreios(desc) {
  const d = norm(desc);
  if (/entregue|entrega efetuada/.test(d))              return "entregue";
  if (/saiu para entrega|em rota de entrega/.test(d))   return "saiu_entrega";
  if (/em transito|transferencia|encaminhado/.test(d))  return "em_transito";
  if (/triagem|distribuicao/.test(d))                   return "hub_entrada";
  if (/postado|aceito/.test(d))                         return "postado";
  return "em_transito";
}


// ─────────────────────────────────────────────────────────────
//  TIMELINE PEGAKI ESTIMADA
//  Determinística: mesmo código = mesma timeline sempre
// ─────────────────────────────────────────────────────────────
function gerarTimelinePegaki(codigo) {
  const h   = hashStr(codigo);
  const now = Date.now();
  const qtd = Math.min(4, Math.max(1, (h % 4) + 1));

  const pontos = [
    "Ponto Parceiro — Av. Paulista, SP",
    "Ponto Parceiro — Centro, RJ",
    "Ponto Parceiro — Boa Vista, PR",
    "Ponto Parceiro — Bairro Novo, MG",
    "Ponto Parceiro — Centro, RS",
  ];
  const hubs = [
    "HUB Pegaki — Guarulhos/SP",
    "HUB Pegaki — São Paulo/SP",
    "HUB Pegaki — Curitiba/PR",
    "HUB Pegaki — Rio de Janeiro/RJ",
    "HUB Pegaki — Belo Horizonte/MG",
  ];
  const locais = {
    postado:       pontos[h % pontos.length],
    coletado:      pontos[h % pontos.length],
    hub_entrada:   hubs[h % hubs.length],
    hub_unitizado: hubs[h % hubs.length],
  };

  const eventos = [];
  let ts = now - (2 + (h % 8)) * 3600000;

  for (let i = qtd - 1; i >= 0; i--) {
    const et = ETAPAS[i];
    eventos.push({
      etapaId:        et.id,
      descricao:      et.label,
      data:           fmtTs(ts),
      local:          locais[et.id] || null,
      transportadora: null,
    });
    ts -= (4 + ((h + i * 5) % 12)) * 3600000;
  }

  eventos.sort((a, b) => ordemEtapa(b.etapaId) - ordemEtapa(a.etapaId));
  const etapaAtual = ETAPAS[qtd - 1];

  return {
    ok: true, codigo, encontrado: true,
    tipo: "pegaki_estimado", real: false, estimado: true,
    etapaAtual, parado: false,
    eventos, etapas: ETAPAS,
  };
}


// ─────────────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────────────
function detectarParado(eventos) {
  if (!eventos.length) return false;
  const ev = eventos[0];
  if (!["postado","coletado"].includes(ev.etapaId)) return false;
  if (!ev.data) return false;
  try {
    const m = ev.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return false;
    const dt = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    return (Date.now() - dt.getTime()) / 86400000 > 2;
  } catch (_) { return false; }
}

function buildLocal(u) {
  if (!u) return null;
  if (typeof u === "string") return u;
  const c = u.endereco?.cidade || u.cidade || u.nome || null;
  const f = u.endereco?.uf || u.uf || null;
  return [c, f].filter(Boolean).join("/") || null;
}

function ordemEtapa(id) {
  return ETAPAS.find(e => e.id === id)?.ordem ?? 0;
}

function norm(s) {
  return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function fmtData(raw) {
  if (!raw) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(String(raw))) return String(raw);
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  } catch (_) { return String(raw); }
}

function fmtTs(ts) {
  return new Date(ts).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

function getJson(url, ms) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: { "User-Agent": "PegakiBot/2.0", "Accept": "application/json" },
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        getJson(res.headers.location, ms).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8"))); }
        catch (_) { resolve(null); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(ms, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function respJson(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}
