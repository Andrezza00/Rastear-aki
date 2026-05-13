
"use strict";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const codigo = (event.queryStringParameters || {}).codigo || "";

  if (!codigo) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ ok: false, erro: "Código obrigatório" }),
    };
  }

  const eventos = gerarTimelineFake(codigo);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      codigo,
      transportadora: "Pegaki",
      aviso: "Rastreamento simulado profissional (sem API externa)",
      eventos,
    }),
  };
};

// 📦 TIMELINE PROFISSIONAL PEGAKI
function gerarTimelineFake(codigo) {
  const agora = Date.now();
  const dia = 86400000;

  return [
    {
      status: "📦 Postado no ponto Pegaki",
      data: new Date(agora - 4 * dia).toISOString(),
      local: "Ponto de coleta Pegaki",
    },
    {
      status: "🚚 Coletado pela Pegaki",
      data: new Date(agora - 3 * dia).toISOString(),
      local: "Em rota para o HUB",
    },
    {
      status: "🏢 Chegou ao Centro Logístico (HUB)",
      data: new Date(agora - 2 * dia).toISOString(),
      local: "HUB de separação",
    },
    {
      status: "📦 Preparado para transporte",
      data: new Date(agora - 1 * dia).toISOString(),
      local: "Aguardando transportadora",
    },
    {
      status: "🎉 Saiu para entrega",
      data: new Date(agora).toISOString(),
      local: "Transportadora final",
    },
  ];
}
