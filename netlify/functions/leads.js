/**
 * ═══════════════════════════════════════════════════════════
 *  Pegaki — leads.js  |  Netlify Function
 *  Responsável por: fluxo ponto Pegaki, consulta CNPJ, Google Sheets
 * ═══════════════════════════════════════════════════════════
 *
 *  📌 COMO EDITAR ESTE ARQUIVO:
 *  - ID da planilha Google Sheets → SHEET_ID abaixo
 *  - Colunas da planilha          → seção MAPEAMENTO DE COLUNAS
 *  - Mensagens de resposta        → seção MENSAGENS DO FLUXO PONTO
 *
 *  📌 COMO TORNAR A PLANILHA ACESSÍVEL:
 *  1. Abra a planilha no Google Sheets
 *  2. Clique em Compartilhar → "Qualquer pessoa com o link" → Leitor
 *  3. Cole o ID da planilha em SHEET_ID abaixo
 *
 *  📌 FORMATO ESPERADO DA PLANILHA:
 *  Linha 1 = cabeçalho (CNPJ, CEP, Cidade, Região, etc.)
 *  Linha 2 em diante = dados
 * ═══════════════════════════════════════════════════════════
 */

"use strict";

const https = require("https");


// ═══════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DA PLANILHA
//  📝 Substitua o SHEET_ID pelo ID da sua planilha
//  📝 O ID está na URL: docs.google.com/spreadsheets/d/[ID_AQUI]/edit
// ═══════════════════════════════════════════════════════════
const SHEET_ID  = "1wDnV-xHB-vY-K7FVdE3MSxGbiSRlRLwI9o2mcqu-mMQ";
const SHEET_GID = "0"; // aba (gid=0 = primeira aba)

// URL pública de export CSV (não precisa de autenticação se planilha for pública)
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;


// ═══════════════════════════════════════════════════════════
//  MAPEAMENTO DE COLUNAS DA PLANILHA
//  📝 Ajuste os índices (0 = primeira coluna, 1 = segunda, etc.)
//  📝 Baseado no cabeçalho da sua planilha
// ═══════════════════════════════════════════════════════════
const COLUNAS = {
  cnpj:   0,   // coluna A
  cep:    1,   // coluna B
  cidade: 2,   // coluna C
  regiao: 3,   // coluna D (opcional — se não tiver, usar cidade)
  nome:   4,   // coluna E (nome do responsável, opcional)
  status: 5,   // coluna F (status do cadastro, opcional)
};


// ═══════════════════════════════════════════════════════════
//  MENSAGENS DO FLUXO PONTO PEGAKI
//  📝 Edite os textos abaixo sem medo
//  📝 Use ${regiao}, ${cnpj} para inserir dados dinâmicos
// ═══════════════════════════════════════════════════════════
const MSGS_LEADS = {

  // ── CNPJ encontrado na planilha ─────────────────────────
  // 📝 Edite aqui a resposta quando o CNPJ já está cadastrado
  encontrado: (regiao, cnpj) => `
    ✅ <strong>Cadastro localizado em nossa base!</strong><br><br>
    Verificamos que o seu pré-cadastro já consta em nossa base de interessados para a região de <strong>${regiao}</strong>.<br><br>
    No momento ainda não estamos em processo de expansão nessa localidade, porém seus dados permanecem registrados em nosso sistema para futuras oportunidades.<br><br>
    A Pegaki busca constantemente ampliar sua rede de pontos parceiros. A ativação de novos pontos depende de fatores como:<br>
    • Demanda logística da região<br>
    • Volumetria de envios<br>
    • Cobertura operacional<br>
    • Solicitações dos marketplaces parceiros<br><br>
    Assim que surgir uma oportunidade compatível com sua localidade e perfil, nossa equipe entrará em contato utilizando os dados cadastrados.<br><br>
    Agradecemos muito pelo seu interesse em fazer parte da rede Pegaki! 😊`,

  // ── CNPJ NÃO encontrado na planilha ─────────────────────
  // 📝 Edite aqui a resposta quando o CNPJ não está cadastrado
  naoEncontrado: (cnpj) => `
    📋 <strong>Cadastro não localizado</strong><br><br>
    Não encontramos o CNPJ <strong>${cnpj}</strong> em nossa base de pré-cadastros.<br><br>
    Para registrar seu interesse, acesse o formulário oficial:<br>
    👉 <a href="https://conteudo.pegaki.com.br/seja-ponto-pegaki" target="_blank">conteudo.pegaki.com.br/seja-ponto-pegaki</a><br><br>
    Após preencher, seus dados entrarão em nossa base de interessados e nossa equipe poderá entrar em contato quando houver oportunidade na sua região. 😊`,

  // ── Erro na consulta ────────────────────────────────────
  // 📝 Edite aqui a mensagem de erro técnico
  erro: () => `
    ⚠️ <strong>Não conseguimos consultar no momento</strong><br><br>
    Tivemos uma dificuldade técnica ao acessar nossa base de dados. Por favor, tente novamente em alguns instantes.<br><br>
    Se o problema persistir, entre em contato: <a href="mailto:ajuda@pegaki.com.br">ajuda@pegaki.com.br</a>`,

};


// ─────────────────────────────────────────────────────────────
//  CORS
// ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type":                 "application/json; charset=utf-8",
};


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
  const cnpjRaw = (params.cnpj || "").trim().replace(/\D/g, ""); // só dígitos

  if (!cnpjRaw || cnpjRaw.length !== 14) {
    return respJson(400, {
      ok: false,
      erro: "Informe um CNPJ válido com 14 dígitos.",
      mensagem: "Por favor, informe o CNPJ completo (14 dígitos, com ou sem pontuação).",
    });
  }

  try {
    const resultado = await consultarPlanilha(cnpjRaw);
    return respJson(200, resultado);
  } catch (err) {
    console.error("[leads.js] Erro:", err.message);
    return respJson(200, {
      ok: false,
      encontrado: false,
      mensagem: MSGS_LEADS.erro(),
      erro: err.message,
    });
  }
};


// ─────────────────────────────────────────────────────────────
//  CONSULTA A PLANILHA
// ─────────────────────────────────────────────────────────────
async function consultarPlanilha(cnpjBusca) {
  const csv = await fetchCsv(SHEET_CSV_URL, 8000);
  if (!csv || csv.length < 10) {
    throw new Error("Planilha não acessível ou vazia.");
  }

  const linhas = parseCsv(csv);
  if (linhas.length < 2) {
    throw new Error("Planilha sem dados.");
  }

  // Pula cabeçalho (linha 0) e busca o CNPJ
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const cnpjPlanilha = (linha[COLUNAS.cnpj] || "").replace(/\D/g, "");

    if (cnpjPlanilha === cnpjBusca) {
      const cidade = linha[COLUNAS.cidade] || "";
      const regiao = linha[COLUNAS.regiao] || cidade || "sua região";
      const cep    = linha[COLUNAS.cep]    || "";
      const nome   = linha[COLUNAS.nome]   || "";

      return {
        ok:          true,
        encontrado:  true,
        cnpj:        cnpjBusca,
        cidade,
        regiao,
        cep,
        nome,
        mensagem:    MSGS_LEADS.encontrado(regiao, formatarCnpj(cnpjBusca)),
      };
    }
  }

  // Não encontrou
  return {
    ok:         true,
    encontrado: false,
    cnpj:       cnpjBusca,
    mensagem:   MSGS_LEADS.naoEncontrado(formatarCnpj(cnpjBusca)),
  };
}


// ─────────────────────────────────────────────────────────────
//  PARSE CSV SIMPLES
// ─────────────────────────────────────────────────────────────
function parseCsv(texto) {
  const linhas = [];
  const rows   = texto.split(/\r?\n/);

  for (const row of rows) {
    if (!row.trim()) continue;
    const cols = [];
    let cur    = "";
    let dentro = false;

    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        dentro = !dentro;
      } else if (c === "," && !dentro) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    linhas.push(cols);
  }

  return linhas;
}


// ─────────────────────────────────────────────────────────────
//  FETCH CSV
// ─────────────────────────────────────────────────────────────
function fetchCsv(url, ms) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "PegakiBot/2.0",
        "Accept": "text/csv,text/plain,*/*",
      },
    }, (res) => {
      // Segue redirect (Google Sheets redireciona)
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        fetchCsv(res.headers.location, ms).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(ms, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}


// ─────────────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────────────
function formatarCnpj(cnpj) {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12)}`;
}

function respJson(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}
