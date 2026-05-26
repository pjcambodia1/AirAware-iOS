exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "POST only" })
    };
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing OPENAI_API_KEY in Netlify environment."
        })
      };
    }

    const payload = JSON.parse(event.body || "{}");

    const openaiBody = {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `You are AirAware Wellness Interpreter.
Use ONLY the provided AirAware data.
Do NOT invent values.
Do NOT diagnose disease.
Give calm, practical, personalized wellness guidance.
Keep it concise and specific to age, BP profile, pulse, sensitivity, elevation, density-altitude burden, 24h shift, 30min shift, terrain, and day/night.
Return valid JSON only with these exact keys:
headline, summary, bpNote, bodyNote, suggestions, confidence, disclaimer.`
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(openaiBody)
    });

    const rawText = await response.text();

    if (!response.ok) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OpenAI request failed.",
          status: response.status,
          detail: rawText.slice(0, 1000)
        })
      };
    }

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OpenAI returned non-JSON response.",
          detail: rawText.slice(0, 1000)
        })
      };
    }

    let outputText =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "";

    if (!outputText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          const textPart = item.content.find(
            c => c.text || c.type === "output_text"
          );

          if (textPart?.text) {
            outputText = textPart.text;
            break;
          }
        }
      }
    }

    if (!outputText) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OpenAI response did not include output_text.",
          debugKeys: Object.keys(data || {})
        })
      };
    }

    let report;

    try {
      report = JSON.parse(outputText);
    } catch (jsonErr) {
      const match = outputText.match(/\{[\s\S]*\}/);

      if (match) {
        try {
          report = JSON.parse(match[0]);
        } catch (nestedErr) {
          return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              error: "Could not parse report JSON.",
              detail: outputText.slice(0, 1000)
            })
          };
        }
      } else {
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "OpenAI output was not JSON.",
            detail: outputText.slice(0, 1000)
          })
        };
      }
    }

    const safeReport = {
      headline:
        report.headline || "AirAware wellness report",

      summary:
        report.summary ||
        "AirAware generated a wellness interpretation from the available data.",

      bpNote:
        report.bpNote ||
        "BP interpretation depends on the profile or readings provided.",

      bodyNote:
        report.bodyNote ||
        "Body response may vary by sensitivity and current conditions.",

      suggestions: Array.isArray(report.suggestions)
        ? report.suggestions.slice(0, 4)
        : [],

      confidence:
        report.confidence ||
        "Moderate — based on available AirAware inputs.",

      disclaimer:
        report.disclaimer ||
        "Wellness guidance only. Not medical advice, diagnosis, or treatment."
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        ...safeReport,

        meta: {
          generatedAt: new Date().toISOString(),
          location: payload.locationName ?? null,
          elevationM: payload.actualElevationM ?? null,
          densityAltitudeM: payload.densityAltitudeM ?? null,
          daBurdenM: payload.daBurdenM ?? null,
          shift24hM: payload.shift24hM ?? null,
          shift30mM: payload.shift30mM ?? null
        },

        userContext: {
          bpProfile: payload.bpProfile ?? "unknown",
          pulseBpm: payload.pulseBpm ?? null,
          sensitivity: payload.sensitivity ?? null,
          ageGroup: payload.ageGroup ?? "unknown",
          adaptiveScore: payload.adaptiveScore ?? 0
        },

        diagnostics: {
          version: "1.1",
          source: "airaware-netlify",
          model: "gpt-4.1-mini"
        }
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        error: "Wellness report failed.",
        detail: err?.message || String(err)
      })
    };
  }
};
