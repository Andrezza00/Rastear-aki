"use strict";

const https = require("https");

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

  try {
    const url = `https://tracking.pegaki.com.br/rastreamento/${encodeURIComponent(codigo)}`;
    const html = await fetchHtml(url);

    const eventos = extrairEventosSimples(html);

    if (!eventos.length) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: false,
          codigo,
          mensagem: "Pedido não encontrado ou sem eventos disponíveis",
          eventos: [],
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        codigo,
        transportadora: "Pegaki",
        eventos,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        erro: "Erro ao consultar rastreio",
        detalhe: err.message,
      }),
    };
  }
};

// 🔎 extrai texto simples da página
function extrairEventosSimples(html) {
  const texto = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const eventos = [];

  if (texto.includes("postado")) {
    eventos.push({ status: "Postado no ponto Pegaki" });
  }

  if (texto.includes("coletado")) {
    eventos.push({ status: "Coletado pela Pegaki" });
  }

  if (texto.includes("hub")) {
    eventos.push({ status: "Em centro logístico (HUB)" });
  }

  if (texto.includes("transportadora")) {
    eventos.push({ status: "Enviado para transportadora" });
  }

  if (texto.includes("entregue")) {
    eventos.push({ status: "Entregue ao destinatário" });
  }

  return eventos;
}

// 🌐 fetch simples
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];

      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}
