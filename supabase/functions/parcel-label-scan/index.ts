import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const AWB_RE = /^[A-Z0-9._-]{4,40}$/i;
const TEMP_PHOTO_BUCKET = "parcel-label-temp";
const TEMP_PHOTO_TTL_MS = 6 * 60 * 60 * 1000;

type Extraction = {
  readable: boolean;
  recipient_name: string;
  phone: string;
  pincode: string;
  address: string;
  order_reference: string;
  payable_amount: number | null;
  courier_name: string;
  printed_tracking_number: string;
  barcode_value: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 180): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizePhone(value: unknown): string {
  const valueDigits = digits(value);
  return valueDigits.length >= 10 ? valueDigits.slice(-10) : valueDigits;
}

function normalizeName(value: unknown): string[] {
  const ignored = new Set(["mr", "mrs", "ms", "miss", "shri", "smt", "ji"]);
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1 && !ignored.has(part));
}

function nameScore(expected: string, actual: string): number {
  const a = new Set(normalizeName(expected));
  const b = new Set(normalizeName(actual));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

function normalizeAwb(value: unknown): string {
  return clean(value, 40).replace(/\s+/g, "").toUpperCase();
}

function courierSlug(value: unknown): string {
  const v = clean(value).toLowerCase();
  if (/india\s*post|speed\s*post/.test(v)) return "india_post";
  if (/delhivery/.test(v)) return "delhivery";
  if (/xpressbees/.test(v)) return "xpressbees";
  if (/ecom\s*express/.test(v)) return "ecom_express";
  if (/blue\s*dart/.test(v)) return "bluedart";
  if (/dtdc/.test(v)) return "dtdc";
  if (/ekart/.test(v)) return "ekart";
  if (/shadowfax/.test(v)) return "shadowfax";
  if (/amazon/.test(v)) return "amazon_shipping";
  return "other";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readResponseStream(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let output = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload);
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") output += event.delta;
        if (event.type === "response.failed") throw new Error(event.response?.error?.message || "Label reading failed");
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  return output;
}

async function inspectLabel(bytes: Uint8Array, mime: string, barcodeHint: string): Promise<Extraction> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("AI scanning is not configured");
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      readable: { type: "boolean" },
      recipient_name: { type: "string" },
      phone: { type: "string" },
      pincode: { type: "string" },
      address: { type: "string" },
      order_reference: { type: "string" },
      payable_amount: { type: ["number", "null"] },
      courier_name: { type: "string" },
      printed_tracking_number: { type: "string" },
      barcode_value: { type: "string" },
    },
    required: ["readable", "recipient_name", "phone", "pincode", "address", "order_reference", "payable_amount", "courier_name", "printed_tracking_number", "barcode_value"],
  };
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Read this Indian courier parcel label. Extract only clearly visible values; use empty strings and null rather than guessing. Tracking values must contain only the actual AWB characters. The browser independently saw this possible barcode: ${barcodeHint || "none"}. Treat it only as a hint and independently inspect the image.` },
          { type: "input_image", image_url: `data:${mime};base64,${bytesToBase64(bytes)}` },
        ],
      }],
      text: { format: { type: "json_schema", name: "parcel_label", strict: true, schema } },
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("[parcel-label-scan] AI error", response.status, details);
    const safeMessage = (() => {
      try { return clean(JSON.parse(details)?.message || JSON.parse(details)?.error?.message, 240); } catch { return ""; }
    })();
    const error = new Error(safeMessage || "Could not read the parcel label");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const text = await readResponseStream(response);
  if (!text) throw new Error("No readable label details were returned");
  return JSON.parse(text) as Extraction;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Please sign in again" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Scanning service is unavailable" }, 500);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.slice(7);
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== "string") return json({ error: "Please sign in again" }, 401);

    const form = await req.formData().catch(() => null);
    const image = form?.get("image");
    const orderId = clean(form?.get("order_id"), 50);
    const barcodeHint = normalizeAwb(form?.get("barcode_hint"));
    if (!(image instanceof File) || !orderId) return json({ error: "Take a parcel-label photo first" }, 400);
    if (image.size < 1000 || image.size > MAX_IMAGE_BYTES) return json({ error: "Use a clear photo smaller than 8 MB" }, 413);
    // WhatsApp IMAGE template headers accept JPEG/PNG. The browser converts
    // WebP selections to JPEG before upload so an accepted scan is always
    // directly usable by Meta without keeping a second converted copy.
    if (!new Set(["image/jpeg", "image/png"]).has(image.type)) return json({ error: "Use a JPG or PNG photo" }, 415);

    const admin = createClient(url, serviceKey);
    const { data: expiredPhotos } = await admin
      .from("parcel_label_scans")
      .select("id,temp_object_path")
      .not("temp_object_path", "is", null)
      .is("photo_deleted_at", null)
      .lte("temp_expires_at", new Date().toISOString())
      .limit(50);
    for (const expired of expiredPhotos ?? []) {
      const path = String((expired as any).temp_object_path || "");
      if (path) await admin.storage.from(TEMP_PHOTO_BUCKET).remove([path]);
      await admin.from("parcel_label_scans").update({
        temp_object_path: null,
        photo_deleted_at: new Date().toISOString(),
      }).eq("id", (expired as any).id);
    }
    const { data: order } = await admin
      .from("orders")
      .select("id,store_id,order_number,customer_name,customer_phone,street_address,city,state,pincode,total,balance_due,status,stores!inner(owner_id)")
      .eq("id", orderId)
      .maybeSingle();
    const ownerId = (order as any)?.stores?.owner_id;
    if (!order || ownerId !== userId) return json({ error: "Order not found" }, 404);

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentScans } = await admin
      .from("parcel_label_scans")
      .select("id", { count: "exact", head: true })
      .eq("scanned_by", userId)
      .gte("created_at", tenMinutesAgo);
    if ((recentScans ?? 0) >= 20) return json({ error: "Too many scans. Please wait a few minutes." }, 429);

    const bytes = new Uint8Array(await image.arrayBuffer());
    const imageHash = await sha256(bytes);
    const { data: reusedImage } = await admin
      .from("parcel_label_scans")
      .select("id,order_id,tracking_number,courier_slug,confidence,temp_object_path,temp_expires_at")
      .eq("store_id", order.store_id)
      .eq("image_sha256", imageHash)
      .eq("decision", "accepted")
      .maybeSingle();
    if (reusedImage && reusedImage.order_id !== orderId) {
      return json({ decision: "rejected", error: "This parcel photo was already used for another order." }, 409);
    }
    if (reusedImage?.tracking_number && reusedImage.order_id === orderId) {
      const reusableUntil = reusedImage.temp_expires_at ? new Date(reusedImage.temp_expires_at).getTime() : 0;
      if (!reusedImage.temp_object_path || reusableUntil <= Date.now()) {
        const extension = image.type === "image/png" ? "png" : "jpg";
        const objectPath = `${order.store_id}/${orderId}/${reusedImage.id}.${extension}`;
        const expiresAt = new Date(Date.now() + TEMP_PHOTO_TTL_MS).toISOString();
        const { error: uploadError } = await admin.storage.from(TEMP_PHOTO_BUCKET).upload(objectPath, bytes, {
          contentType: image.type,
          upsert: true,
          cacheControl: "300",
        });
        if (uploadError) throw new Error("The label matched, but its temporary photo could not be prepared. Please retry.");
        await admin.from("parcel_label_scans").update({
          temp_object_path: objectPath,
          temp_expires_at: expiresAt,
          photo_deleted_at: null,
        }).eq("id", reusedImage.id);
      }
      return json({
        decision: "accepted",
        scan_id: reusedImage.id,
        confidence: Number(reusedImage.confidence ?? 1),
        courier_slug: reusedImage.courier_slug || "other",
        tracking_number: reusedImage.tracking_number,
        matched: { name: true },
      });
    }

    const extracted = await inspectLabel(bytes, image.type, barcodeHint);
    const printedAwb = normalizeAwb(extracted.printed_tracking_number);
    const imageBarcode = normalizeAwb(extracted.barcode_value);
    const candidateAwb = imageBarcode || printedAwb || barcodeHint;
    const reasons: string[] = [];
    const hardFailures: string[] = [];

    if (!extracted.readable) reasons.push("The label is not clear enough to verify.");
    if (!candidateAwb || !AWB_RE.test(candidateAwb)) reasons.push("No valid tracking number was found.");
    if (imageBarcode && printedAwb && imageBarcode !== printedAwb) hardFailures.push("The barcode and printed tracking number do not agree.");
    if (barcodeHint && imageBarcode && barcodeHint !== imageBarcode) hardFailures.push("The detected barcode could not be confirmed from the label.");

    const expectedPin = digits(order.pincode).slice(-6);
    const actualPin = digits(extracted.pincode).slice(-6);
    if (expectedPin && actualPin && expectedPin !== actualPin) hardFailures.push("The PIN code belongs to a different delivery address.");

    const expectedPhone = normalizePhone(order.customer_phone);
    const actualPhone = normalizePhone(extracted.phone);
    const phoneExact = expectedPhone.length === 10 && actualPhone.length === 10 && expectedPhone === actualPhone;
    if (expectedPhone.length === 10 && actualPhone.length === 10 && !phoneExact) hardFailures.push("The phone number belongs to a different customer.");

    const recipientScore = nameScore(order.customer_name, extracted.recipient_name);
    if (extracted.recipient_name && recipientScore < 0.5) hardFailures.push("The recipient name does not match this order.");
    if (!extracted.recipient_name) reasons.push("The recipient name was not readable.");

    const referenceDigits = digits(extracted.order_reference);
    const orderReferenceMatch = !!referenceDigits && referenceDigits.includes(String(order.order_number));
    if (referenceDigits && !orderReferenceMatch) hardFailures.push("The printed order reference does not match this order.");

    const expectedAmount = Number(order.balance_due ?? order.total ?? 0);
    const amountRead = typeof extracted.payable_amount === "number" ? extracted.payable_amount : null;
    const amountMatch = amountRead !== null && Math.abs(amountRead - expectedAmount) <= 1;
    if (amountRead !== null && !amountMatch) hardFailures.push("The payable amount does not match this order.");

    const { count: similarOpenOrders } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", order.store_id)
      .neq("id", orderId)
      .in("status", ["pending", "confirmed", "partially_paid", "shipped"])
      .eq("customer_phone", order.customer_phone);
    if ((similarOpenOrders ?? 0) > 0 && !orderReferenceMatch && !amountMatch) {
      reasons.push("This customer has another open order; the label needs a matching order reference or payable amount.");
    }

    if (candidateAwb) {
      const { data: priorAcceptedAwb } = await admin
        .from("parcel_label_scans")
        .select("order_id")
        .eq("store_id", order.store_id)
        .ilike("tracking_number", candidateAwb)
        .eq("decision", "accepted")
        .limit(1);
      if ((priorAcceptedAwb ?? []).some((scan) => scan.order_id !== orderId)) {
        hardFailures.push("This tracking number was already verified for another order.");
      }
      const { data: usedAwb } = await admin
        .from("order_shipments")
        .select("order_id")
        .eq("store_id", order.store_id)
        .ilike("awb", candidateAwb)
        .neq("order_id", orderId)
        .limit(1);
      if ((usedAwb ?? []).length > 0) hardFailures.push("This tracking number is already attached to another order.");
    }

    let confidence = 0;
    if (candidateAwb) confidence += 0.25;
    if (recipientScore >= 0.8) confidence += 0.25;
    else if (recipientScore >= 0.5) confidence += 0.12;
    if (phoneExact) confidence += 0.25;
    if (expectedPin && actualPin === expectedPin) confidence += 0.15;
    if (orderReferenceMatch || amountMatch) confidence += 0.1;
    confidence = Math.min(1, confidence);

    const hasHardIdentity = phoneExact || (expectedPin && actualPin === expectedPin && recipientScore >= 0.8);
    const decision = hardFailures.length > 0 ? "rejected" : extracted.readable && candidateAwb && hasHardIdentity && reasons.length === 0 && confidence >= 0.75 ? "accepted" : "review";
    const allReasons = [...hardFailures, ...reasons];
    const evidence = {
      name_match: Number(recipientScore.toFixed(2)),
      phone_match: phoneExact,
      pincode_match: !!expectedPin && actualPin === expectedPin,
      order_reference_match: orderReferenceMatch,
      amount_match: amountMatch,
      phone_last4: actualPhone.slice(-4),
      pincode: actualPin,
    };

    const alreadyAcceptedForOrder = candidateAwb
      ? await admin
        .from("parcel_label_scans")
        .select("id")
        .eq("store_id", order.store_id)
        .eq("order_id", orderId)
        .ilike("tracking_number", candidateAwb)
        .eq("decision", "accepted")
        .limit(1)
      : { data: [] as Array<{ id: string }> };

    let scanId = (alreadyAcceptedForOrder.data ?? [])[0]?.id || null;
    if (!(decision === "accepted" && scanId)) {
      const { data: insertedScan, error: insertError } = await admin.from("parcel_label_scans").insert({
      store_id: order.store_id,
      order_id: orderId,
      scanned_by: userId,
      image_sha256: imageHash,
      decision,
      confidence,
      courier_slug: candidateAwb ? courierSlug(extracted.courier_name) : null,
      tracking_number: candidateAwb || null,
      evidence,
      reasons: allReasons,
      }).select("id").single();
      if (insertError) throw insertError;
      scanId = insertedScan?.id || null;
    }

    if (decision === "rejected") return json({ decision, confidence, error: "Wrong parcel — this label does not match this customer.", reasons: allReasons }, 422);
    if (decision === "review") return json({ decision, confidence, error: allReasons[0] || "We could not safely verify this label. Take a clearer photo or enter the tracking number manually.", reasons: allReasons }, 422);

    if (!scanId) throw new Error("The verified scan could not be saved");
    const extension = image.type === "image/png" ? "png" : "jpg";
    const objectPath = `${order.store_id}/${orderId}/${scanId}.${extension}`;
    const expiresAt = new Date(Date.now() + TEMP_PHOTO_TTL_MS).toISOString();
    const { error: uploadError } = await admin.storage.from(TEMP_PHOTO_BUCKET).upload(objectPath, bytes, {
      contentType: image.type,
      upsert: true,
      cacheControl: "300",
    });
    if (uploadError) throw new Error("The label matched, but its temporary photo could not be prepared. Please retry.");
    const { error: photoRecordError } = await admin.from("parcel_label_scans").update({
      temp_object_path: objectPath,
      temp_expires_at: expiresAt,
      photo_deleted_at: null,
    }).eq("id", scanId).eq("order_id", orderId).eq("scanned_by", userId);
    if (photoRecordError) {
      await admin.storage.from(TEMP_PHOTO_BUCKET).remove([objectPath]);
      throw new Error("The temporary parcel photo could not be secured. Please retry.");
    }

    return json({
      decision,
      scan_id: scanId,
      confidence,
      courier_slug: courierSlug(extracted.courier_name),
      tracking_number: candidateAwb,
      matched: { name: true, phone: phoneExact, pincode: !!expectedPin && actualPin === expectedPin },
    });
  } catch (error) {
    console.error("[parcel-label-scan] unexpected", error);
    const status = Number((error as Error & { status?: number })?.status || 500);
    return json({ error: clean((error as Error)?.message || "Could not scan the parcel label", 240) }, status);
  }
});