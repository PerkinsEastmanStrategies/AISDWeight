import { insertWeightingSubmission } from "./_insert-weighting.mjs";

function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string" && req.body.trim()) {
    return Promise.resolve(JSON.parse(req.body));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  try {
    const body = await readJson(req);
    const result = await insertWeightingSubmission(body, process.env);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save to Supabase.";
    res.statusCode = 500;
    res.end(JSON.stringify({ error: message }));
  }
}
