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

  try {
    // 🔥 endpoint correto usado pelo próprio site (API interna)
    const url = `https://tracking.pegaki.com.br/api/v1/tracking/${codigo}`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: false,
          codigo,
          erro: "Rastreio não encontrado ou indisponível",
          eventos: [],
        }),
      };
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        codigo,
        transportadora: "Pegaki",
        eventos: data.events || data.trackingEvents || [],
        raw: data,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        erro: "Erro ao consultar Pegaki",
        detalhe: err.message,
      }),
    };
  }
};
