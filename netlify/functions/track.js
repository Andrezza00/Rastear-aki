/**
 * Pegaki — track.js
 * Netlify Function para rastreamento de pedidos
 * Arquitetura preparada para múltiplas transportadoras
 *
 * Handler: exports.handler = async (event) => {}
 */

"use strict";

const https = require("https");
const http  = require("http");

// ─────────────────────────────────────────────────────────────
// ETAPAS PEGAKI — Ordem cronológica do processo logístico
// ─────────────────────────────────────────────────────────────
const ETAPAS = [
  {
    id: "postado",
    ordem: 1,
    label: "Postado no ponto Pegaki",
    icone: "📦",
    cor: "postado",
    responsavel: "pegaki",
    palavras: [
      "postado", "postagem", "recebido no ponto", "ponto de coleta",
      "aguarda retirada", "objeto recebido", "aguardando coleta"
    ],
  },
  {
    id: "coletado",
    ordem: 2,
    label: "Coletado no ponto",
    icone: "🚚",
    cor: "coletado",
    responsavel: "pegaki",
    palavras: [
      "coleta realizada", "coletado no ponto", "coletado pela pegaki",
      "saiu do ponto", "em deslocamento para o hub"
    ],
  },
  {
    id: "hub_entrada",
    ordem: 3,
    label: "Chegou ao HUB Pegaki",
    icone: "🏢",
    cor: "hub",
    responsavel: "pegaki",
    palavras: [
      "entrada no hub", "chegou ao hub", "recebido no hub",
      "entrada hub", "objeto recebido no centro logístico", "centro logístico"
    ],
  },
  {
    id: "hub_unitizado",
    ordem: 4,
    label: "Preparado no HUB",
    icone: "✅",
    cor: "hub",
    responsavel: "pegaki",
    palavras: [
      "unitizado", "preparado no hub", "unitização", "separado e preparado",
      "aguarda coleta pela transportadora", "aguardando transportadora"
    ],
  },
  {
    id: "saiu_hub",
    ordem: 5,
    label: "Saiu com a transportadora",
    icone: "🎉",
    cor: "transportadora",
    responsavel: "transportadora",
    palavras: [
      "saída do hub", "saiu do hub", "coletado pela transportadora",
      "saída hub", "entregue à transportadora", "entregue a transportadora",
      "expedido", "saiu para transportadora"
    ],
  },
  {
    id: "em_transito",
    ordem: 6,
    label: "Em trânsito",
    icone: "🛣️",
    cor: "transito",
    responsavel: "transportadora",
    palavras: [
      "em trânsito", "em transito", "a caminho", "in transit",
      "transferência", "transferencia", "em rota"
    ],
  },
  {
    id: "saiu_entrega",
    ordem: 7,
    label: "Saiu para entrega",
    icone: "🏃",
    cor: "entrega",
    responsavel: "transportadora",
    palavras: [
      "saiu para entrega", "em rota de entrega", "out for delivery",
      "entregador a caminho", "saindo para entrega"
    ],
  },
  {
    id: "entregue",
    ordem: 8,
    label: "Entregue ao destinatário",
    icone: "🎊",
    cor: "entregue",
    responsavel: "transportadora",
    palavras: [
      "entregue", "entrega realizada", "delivered",
      "objeto entregue ao destinatário", "entrega efetuada"
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// FONTES DE RASTREAMENTO
// ─────────────────────────────────────────────────────────────
const FONTES = {
  pegaki:      (codigo) => `https://tracking.pegaki.com.br/rastreamento/${encodeURIComponent(codigo)}`,
  melhorenvio: (codigo) => `https://melhorrastreio.com.br/rastreio/${encodeURIComponent(codigo)}`,
  frenet:      (codigo) => `https://rastreio-c01.frenet.dev/${encodeURIComponent(codigo)}`,
  correios:    (codigo) => `https://rastreamento.correios.com.br/app/index.php`,
};

// ─────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Valida método
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, erro: "Método não permitido" }),
    };
  }

  const params  = event.queryStringParameters || {};
  const codigo  = (params.codigo || "").trim().replace(/\s+/g, "");
  const fonte   = (params.fonte  || "pegaki").toLowerCase();

  if (!codigo) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, erro: "Parâmetro 'codigo' é obrigatório" }),
    };
  }

  try {
    const resultado = await buscarRastreamento(codigo, fonte);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(resultado),
    };
  } catch (err) {
    console.error("[track.js] Erro:", err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        erro: "Falha ao buscar rastreamento",
        detalhe: err.message,
      }),
    };
  }
};

// ─────────────────────────────────────────────────────────────
// BUSCA RASTREAMENTO
// ─────────────────────────────────────────────────────────────
async function buscarRastreamento(codigo, fonte) {
  const urlFn = FONTES[fonte] || FONTES.pegaki;
  const url   = urlFn(codigo);

  let html;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    return { ok: false, codigo, encontrado: false, eventos: [], etapaAtual: null, erro: err.message };
  }

  return parsearResposta(html, codigo, fonte);
}

// ─────────────────────────────────────────────────────────────
// PARSER HTML / JSON
// ─────────────────────────────────────────────────────────────
function parsearResposta(html, codigo, fonte) {
  // 1. Tenta extrair JSON embutido (SPA/SSR/Nuxt/Next/Vite)
  const padroesJson = [
    /window\.__NUXT__\s*=\s*([\s\S]+?);<\/script>/i,
    /window\.__INITIAL_STATE__\s*=\s*([\s\S]+?);<\/script>/i,
    /window\.__DATA__\s*=\s*([\s\S]+?);<\/script>/i,
    /window\.trackingData\s*=\s*([\s\S]+?);<\/script>/i,
    /window\.pageData\s*=\s*([\s\S]+?);<\/script>/i,
    /__NEXT_DATA__['"]\s*type=["']application\/json["'][^>]*>([\s\S]+?)<\/script>/i,
  ];

  for (const padrao of padroesJson) {
    const m = html.match(padrao);
    if (m) {
      try {
        const obj = JSON.parse(m[1]);
        const eventos = extrairEventosDeObjeto(obj);
        if (eventos.length > 0) return montarResposta(codigo, eventos, fonte, "json_embutido");
      } catch (_) {}
    }
  }

  // 2. Tenta <script type="application/json">
  const scriptMatches = [...html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]+?)<\/script>/gi)];
  for (const m of scriptMatches) {
    try {
      const obj = JSON.parse(m[1]);
      const eventos = extrairEventosDeObjeto(obj);
      if (eventos.length > 0) return montarResposta(codigo, eventos, fonte, "script_json");
    } catch (_) {}
  }

  // 3. Extrai texto visível como fallback
  const textoVisivel = extrairTextoVisivel(html);

  // Verifica se pedido não encontrado
  const naoEncontrado = /não encontrad|nenhum resultado|código inválido|not found|pedido não exist|invalid/i.test(textoVisivel);
  if (naoEncontrado || textoVisivel.length < 80) {
    return { ok: false, codigo, encontrado: false, eventos: [], etapaAtual: null, fonte };
  }

  // Tenta identificar etapa no texto
  const etapaId = identificarEtapaNoTexto(textoVisivel);
  if (etapaId) {
    const eventos = [{
      etapaId,
      descricao: textoVisivel.substring(0, 400),
      data: null,
      local: null,
      transportadora: null,
    }];
    return montarResposta(codigo, eventos, fonte, "texto_extraido");
  }

  return { ok: false, codigo, encontrado: false, eventos: [], etapaAtual: null, fonte };
}

// ─────────────────────────────────────────────────────────────
// EXTRAI EVENTOS DE OBJETO JSON (recursivo)
// ─────────────────────────────────────────────────────────────
function extrairEventosDeObjeto(obj, profundidade = 0) {
  if (profundidade > 8 || !obj || typeof obj !== "object") return [];

  const chavesAlvo = [
    "eventos", "events", "ocorrencias", "tracking", "historico",
    "history", "rastreamento", "movimentacoes", "status_history",
    "trackingEvents", "deliveryHistory", "shipmentEvents",
  ];

  const resultado = [];

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const sub = extrairEventosDeObjeto(item, profundidade + 1);
      if (sub.length) return sub;
    }
    return resultado;
  }

  for (const chave of Object.keys(obj)) {
    const chaveLower = chave.toLowerCase();
    const val = obj[chave];

    if (chavesAlvo.includes(chaveLower) && Array.isArray(val) && val.length > 0) {
      for (const ev of val) {
        const desc = ev.status || ev.descricao || ev.description || ev.evento
                  || ev.mensagem || ev.message || ev.ocorrencia || "";
        if (!desc) continue;
        resultado.push({
          etapaId: identificarEtapaNoTexto(desc),
          descricao: String(desc).trim(),
          data: formatarData(ev.data || ev.date || ev.dataHora || ev.created_at
                            || ev.timestamp || ev.ocorrencia_data || null),
          local: ev.local || ev.location || ev.cidade || ev.city
               || ev.unidade || ev.agencia || null,
          transportadora: ev.transportadora || ev.carrier || ev.shipping_company || null,
          plataforma: ev.plataforma || ev.platform || null,
        });
      }
      if (resultado.length > 0) return resultado;
    }

    if (val && typeof val === "object") {
      const sub = extrairEventosDeObjeto(val, profundidade + 1);
      if (sub.length > 0) return sub;
    }
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────
// IDENTIFICA ETAPA NO TEXTO
// ─────────────────────────────────────────────────────────────
function identificarEtapaNoTexto(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Prioridade para etapas mais avançadas
  for (let i = ETAPAS.length - 1; i >= 0; i--) {
    const etapa = ETAPAS[i];
    const palavrasNorm = etapa.palavras.map(p =>
      p.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );
    if (palavrasNorm.some(p => t.includes(p))) return etapa.id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// MONTA RESPOSTA NORMALIZADA
// ─────────────────────────────────────────────────────────────
function montarResposta(codigo, eventos, fonte, metodo) {
  // Ordena: mais recente (maior ordem) primeiro
  const ordenados = [...eventos].sort((a, b) => {
    const oa = ETAPAS.find(e => e.id === a.etapaId)?.ordem ?? 0;
    const ob = ETAPAS.find(e => e.id === b.etapaId)?.ordem ?? 0;
    return ob - oa;
  });

  const primeiroEvento  = ordenados[0] || null;
  const etapaAtualDef   = ETAPAS.find(e => e.id === primeiroEvento?.etapaId) || null;

  return {
    ok: true,
    codigo,
    encontrado: true,
    etapaAtual: etapaAtualDef,
    parado: detectarParado(ordenados),
    eventos: ordenados,
    etapasDisponiveis: ETAPAS,
    fonte,
    metodo,
  };
}

// ─────────────────────────────────────────────────────────────
// DETECTA PACOTE PARADO (postado/coletado há +2 dias)
// ─────────────────────────────────────────────────────────────
function detectarParado(eventos) {
  if (!eventos.length) return false;
  const ev = eventos[0];
  if (!ev.etapaId) return false;
  if (!["postado", "coletado"].includes(ev.etapaId)) return false;
  if (!ev.data) return false;

  try {
    let dt = null;
    const matchBR  = ev.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const matchISO = ev.data.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (matchBR)  dt = new Date(`${matchBR[3]}-${matchBR[2]}-${matchBR[1]}`);
    else if (matchISO) dt = new Date(ev.data.substring(0, 10));
    if (!dt || isNaN(dt.getTime())) return false;
    return (Date.now() - dt.getTime()) / 86400000 > 2;
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// EXTRAI TEXTO VISÍVEL DO HTML
// ─────────────────────────────────────────────────────────────
function extrairTextoVisivel(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// FORMATA DATA
// ─────────────────────────────────────────────────────────────
function formatarData(raw) {
  if (!raw) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(String(raw))) return String(raw);
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch (_) {
    return String(raw);
  }
}

// ─────────────────────────────────────────────────────────────
// FETCH HTML COM FOLLOW REDIRECT
// ─────────────────────────────────────────────────────────────
function fetchHtml(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Máximo de redirects excedido"));

    const lib = url.startsWith("https://") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        "Connection": "close",
      },
    };

    const req = lib.get(url, options, (res) => {
      // Segue redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        res.resume();
        fetchHtml(next, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error("Timeout ao buscar rastreamento"));
    });
  });
}
