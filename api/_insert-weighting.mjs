/**
 * Shared Supabase insert used by the Vercel function and local Vite middleware.
 * Writes one weighting_submissions row plus weighting_items. Never stores locally.
 */

function envVal(env, ...keys) {
  for (const key of keys) {
    const v = env?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pgError(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || parsed.hint || text;
  } catch {
    return String(text || "Unknown Supabase error").slice(0, 400);
  }
}

async function restInsert(url, key, table, row, prefer = "return=representation") {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(pgError(text) || `Supabase ${table} insert failed (${res.status}).`);
  }
  return text ? JSON.parse(text) : null;
}

export async function insertWeightingSubmission(body, env) {
  const url = envVal(env, "VITE_SUPABASE_URL", "SUPABASE_URL");
  const key = envVal(env, "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on the server.",
    );
  }

  const company = String(body?.company || "").trim();
  const schoolLevel = String(body?.school_level || "").trim();
  if (!company) throw new Error("Company is required.");
  if (!["ES", "MS", "HS"].includes(schoolLevel)) {
    throw new Error("School level must be ES, MS, or HS.");
  }

  const itemsIn = Array.isArray(body?.items) ? body.items : [];
  const items = itemsIn.filter(
    (item) => item && Number.isInteger(item.weight) && item.weight > 0 && item.item_key && item.layer,
  );

  const inserted = await restInsert(url, key, "weighting_submissions", {
    company,
    contact: body?.contact ? String(body.contact).trim() : null,
    school_level: schoolLevel,
    hierarchy_generated_at: body?.hierarchy_generated_at || null,
    payload_version: 3,
    raw_payload: body?.raw_payload ?? null,
  });
  const id = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
  if (!id) throw new Error("Supabase did not return a submission id.");

  if (items.length > 0) {
    await restInsert(
      url,
      key,
      "weighting_items",
      items.map((item) => ({
        submission_id: id,
        layer: item.layer,
        item_key: item.item_key,
        item_label: item.item_label || item.item_key,
        weight: item.weight,
        comment: item.comment || null,
        include_in_score: item.include_in_score !== false,
        focus_area: item.focus_area || null,
        space_type_id: item.space_type_id || null,
        category: item.category || null,
        subcategory: item.subcategory || null,
      })),
      "return=minimal",
    );
  }

  return { id, itemCount: items.length };
}
