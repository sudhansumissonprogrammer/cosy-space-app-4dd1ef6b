import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const AWB_RE = /^[A-Z0-9._-]{4,40}$/i;
const TEMP_PHOTO_BUCKET = "parcel-label-temp";
const SAVED_PHOTO_BUCKET = "parcel-label-photos";
const TEMP_PHOTO_TTL_MS = 6 * 60 * 60 * 1000;

type Extraction = {
  readable: boolean;
  recipient_phone: string;
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

function normalizeAwb(value: unknown): string {
  return clean(value, 40).replace(/\s+/g, "").toUpperCase();
}

function normalizeIndianPhone(value: unknown): string {
  let phone = String(value ?? "").replace(/\D/g, "");
  if (phone.length === 13 && phone.startsWith("091")) phone = phone.slice(3);
  else if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  return /^[6-9]\d{9}$/.test(phone) ? phone : "";
}

function courierFromAwb(value: string): string {
  return /^[A-Z]{2}\d{9}IN$/.test(value) ? "india_post" : "other";
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
      recipient_phone: { type: "string" },
      printed_tracking_number: { type: "string" },
      barcode_value: { type: "string" },
    },
    required: ["readable", "recipient_phone", "printed_tracking_number", "barcode_value"],
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
      reasoning: { effort: "none" },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Extract only two values from this Indian courier label: (1) the shipment tracking/AWB number and (2) the recipient's complete mobile number. Do not read or return names, addresses, prices, or other text. Keep a visible +91, 91, or leading 0 phone prefix; return an empty phone for masked, partial, or unclear numbers. Return empty strings rather than guessing. The printed tracking value and tracking barcode should agree. Browser 1D-barcode hint: ${barcodeHint || "none"}.` },
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
    const action = clean(form?.get("action"), 20);
    const orderId = clean(form?.get("order_id"), 50);
    const barcodeHint = normalizeAwb(form?.get("barcode_hint"));
    const reviewScanId = clean(form?.get("review_scan_id"), 50);
    const manualAwb = normalizeAwb(form?.get("manual_awb"));
    if (!orderId) return json({ error: "Order is required" }, 400);

    const admin = createClient(url, serviceKey);
    const { data: order } = await admin
      .from("orders")
      .select("id,store_id,customer_phone,stores!inner(owner_id)")
      .eq("id", orderId)
      .maybeSingle();
    const ownerId = (order as any)?.stores?.owner_id;
    if (!order || ownerId !== userId) return json({ error: "Order not found" }, 404);

    if (action === "photo") {
      const { data: savedScan } = await admin
        .from("parcel_label_scans")
        .select("photo_object_path")
        .eq("order_id", orderId)
        .eq("store_id", order.store_id)
        .eq("decision", "accepted")
        .not("photo_object_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!savedScan?.photo_object_path) return json({ photo_url: null });
      const { data: signed, error: signedError } = await admin.storage
        .from(SAVED_PHOTO_BUCKET)
        .createSignedUrl(savedScan.photo_object_path, 5 * 60);
      if (signedError || !signed?.signedUrl) return json({ photo_url: null });
      return json({ photo_url: signed.signedUrl });
    }

    if (reviewScanId || manualAwb) {
      if (!reviewScanId || !manualAwb || !AWB_RE.test(manualAwb)) {
        return json({ error: "Enter a valid tracking number" }, 400);
      }
      const { data: reviewScan } = await admin
        .from("parcel_label_scans")
        .select("id,evidence,temp_object_path,temp_expires_at,courier_slug")
        .eq("id", reviewScanId)
        .eq("order_id", orderId)
        .eq("store_id", order.store_id)
        .eq("scanned_by", userId)
        .eq("decision", "review")
        .maybeSingle();
      const phoneMatched = (reviewScan?.evidence as Record<string, unknown> | null)?.phone_match === true;
      const photoAvailable = !!reviewScan?.temp_object_path
        && !!reviewScan?.temp_expires_at
        && new Date(reviewScan.temp_expires_at).getTime() > Date.now();
      if (!reviewScan || !phoneMatched || !photoAvailable) {
        return json({ error: "Take a new label photo before entering the tracking number" }, 409);
      }
      const [{ data: priorScan }, { data: priorShipment }] = await Promise.all([
        admin.from("parcel_label_scans").select("order_id").eq("store_id", order.store_id).eq("tracking_number", manualAwb).eq("decision", "accepted").neq("order_id", orderId).limit(1),
        admin.from("order_shipments").select("order_id").eq("store_id", order.store_id).eq("awb", manualAwb).neq("order_id", orderId).limit(1),
      ]);
      if ((priorScan ?? []).length > 0 || (priorShipment ?? []).length > 0) {
        return json({ error: "This tracking number is already attached to another order" }, 409);
      }
      const { error: confirmError } = await admin.from("parcel_label_scans").update({
        decision: "accepted",
        confidence: 1,
        tracking_number: manualAwb,
        reasons: [],
      }).eq("id", reviewScan.id).eq("decision", "review");
      if (confirmError) throw confirmError;
      return json({
        decision: "accepted",
        scan_id: reviewScan.id,
        confidence: 1,
        courier_slug: reviewScan.courier_slug || "other",
        tracking_number: manualAwb,
        matched: { phone: true },
      });
    }

    if (!(image instanceof File)) return json({ error: "Take a parcel-label photo first" }, 400);
    if (image.size < 1000 || image.size > MAX_IMAGE_BYTES) return json({ error: "Use a clear photo smaller than 8 MB" }, 413);
    // WhatsApp IMAGE template headers accept JPEG/PNG. The browser converts
    // WebP selections to JPEG before upload so an accepted scan is always
    // directly usable by Meta without keeping a second converted copy.
    if (!new Set(["image/jpeg", "image/png"]).has(image.type)) return json({ error: "Use a JPG or PNG photo" }, 415);

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
        const [tempUpload, savedUpload] = await Promise.all([
          admin.storage.from(TEMP_PHOTO_BUCKET).upload(objectPath, bytes, { contentType: image.type, upsert: true, cacheControl: "300" }),
          admin.storage.from(SAVED_PHOTO_BUCKET).upload(objectPath, bytes, { contentType: image.type, upsert: true, cacheControl: "3600" }),
        ]);
        if (tempUpload.error || savedUpload.error) throw new Error("The label matched, but its parcel photo could not be saved. Please retry.");
        await admin.from("parcel_label_scans").update({
          temp_object_path: objectPath,
          photo_object_path: objectPath,
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
        matched: { phone: true },
      });
    }

    const extracted = await inspectLabel(bytes, image.type, barcodeHint);
    const printedAwb = normalizeAwb(extracted.printed_tracking_number);
    const imageBarcode = normalizeAwb(extracted.barcode_value);
    const candidateAwb = imageBarcode || printedAwb || barcodeHint;
    const expectedPhone = normalizeIndianPhone(order.customer_phone);
    const extractedPhone = normalizeIndianPhone(extracted.recipient_phone);
    const phoneMatched = !!expectedPhone && !!extractedPhone && expectedPhone === extractedPhone;
    const reasons: string[] = [];
    const hardFailures: string[] = [];

    if (!extracted.readable) reasons.push("The label is not clear enough to verify.");
    if (!candidateAwb || !AWB_RE.test(candidateAwb)) reasons.push("No valid tracking number was found.");
    if (!expectedPhone) hardFailures.push("This order does not have a valid 10-digit mobile number.");
    if (!extractedPhone) hardFailures.push("The complete 10-digit mobile number is not readable on this label.");
    if (expectedPhone && extractedPhone && !phoneMatched) hardFailures.push("This parcel belongs to a different customer.");
    if (imageBarcode && printedAwb && imageBarcode !== printedAwb) hardFailures.push("The barcode and printed tracking number do not agree.");
    // Browser BarcodeDetector is only trusted for the strict India Post AWB
    // shape. Every other label is independently read from the image.

    if (candidateAwb) {
      const { data: priorAcceptedAwb } = await admin
        .from("parcel_label_scans")
        .select("order_id")
        .eq("store_id", order.store_id)
        .eq("tracking_number", candidateAwb)
        .eq("decision", "accepted")
        .limit(1);
      if ((priorAcceptedAwb ?? []).some((scan) => scan.order_id !== orderId)) {
        hardFailures.push("This tracking number was already verified for another order.");
      }
      const { data: usedAwb } = await admin
        .from("order_shipments")
        .select("order_id")
        .eq("store_id", order.store_id)
        .eq("awb", candidateAwb)
        .neq("order_id", orderId)
        .limit(1);
      if ((usedAwb ?? []).length > 0) hardFailures.push("This tracking number is already attached to another order.");
    }

    const confidence = extracted.readable && candidateAwb && phoneMatched ? 1 : 0;
    const decision = hardFailures.length > 0 ? "rejected" : extracted.readable && candidateAwb && phoneMatched && reasons.length === 0 ? "accepted" : "review";
    const allReasons = [...hardFailures, ...reasons];
    const evidence = {
      phone_match: phoneMatched,
      phone_last4: extractedPhone.slice(-4),
    };

    const alreadyAcceptedForOrder = candidateAwb
      ? await admin
        .from("parcel_label_scans")
        .select("id")
        .eq("store_id", order.store_id)
        .eq("order_id", orderId)
        .eq("tracking_number", candidateAwb)
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
       courier_slug: candidateAwb ? courierFromAwb(candidateAwb) : null,
      tracking_number: candidateAwb || null,
      evidence,
      reasons: allReasons,
      }).select("id").single();
      if (insertError) throw insertError;
      scanId = insertedScan?.id || null;
    }

    if (decision === "rejected") return json({ decision, confidence, error: allReasons[0] || "This parcel could not be verified.", reasons: allReasons }, 422);

    if (decision === "review") {
      if (!candidateAwb || !scanId) {
        return json({ decision, confidence, error: allReasons[0] || "We could not safely verify this label. Take a clearer photo.", reasons: allReasons }, 422);
      }
      const extension = image.type === "image/png" ? "png" : "jpg";
      const objectPath = `${order.store_id}/${orderId}/${scanId}.${extension}`;
      const expiresAt = new Date(Date.now() + TEMP_PHOTO_TTL_MS).toISOString();
      const [tempUpload, savedUpload] = await Promise.all([
        admin.storage.from(TEMP_PHOTO_BUCKET).upload(objectPath, bytes, { contentType: image.type, upsert: true, cacheControl: "300" }),
        admin.storage.from(SAVED_PHOTO_BUCKET).upload(objectPath, bytes, { contentType: image.type, upsert: true, cacheControl: "3600" }),
      ]);
      if (tempUpload.error || savedUpload.error) throw new Error("The label matched, but its parcel photo could not be saved. Please retry.");
      const { error: photoRecordError } = await admin.from("parcel_label_scans").update({
        temp_object_path: objectPath,
        photo_object_path: objectPath,
        temp_expires_at: expiresAt,
        photo_deleted_at: null,
      }).eq("id", scanId).eq("order_id", orderId).eq("scanned_by", userId);
      if (photoRecordError) {
        await admin.storage.from(TEMP_PHOTO_BUCKET).remove([objectPath]);
        await admin.storage.from(SAVED_PHOTO_BUCKET).remove([objectPath]);
        throw new Error("The parcel photo could not be secured. Please retry.");
      }
      return json({
        decision,
        scan_id: scanId,
        confidence,
        courier_slug: courierFromAwb(candidateAwb),
        tracking_number: candidateAwb || "",
        matched: { phone: true },
        needs_tracking_confirmation: true,
        message: "Enter the complete tracking number printed on this label.",
      });
    }

    if (!scanId) throw new Error("The verified scan could not be saved");
    const extension = image.type === "image/png" ? "png" : "jpg";
    const objectPath = `${order.store_id}/${orderId}/${scanId}.${extension}`;
    const savedObjectPath = `${order.store_id}/${orderId}/${scanId}.${extension}`;
    const expiresAt = new Date(Date.now() + TEMP_PHOTO_TTL_MS).toISOString();
    const [tempUpload, savedUpload] = await Promise.all([
      admin.storage.from(TEMP_PHOTO_BUCKET).upload(objectPath, bytes, { contentType: image.type, upsert: true, cacheControl: "300" }),
      admin.storage.from(SAVED_PHOTO_BUCKET).upload(savedObjectPath, bytes, { contentType: image.type, upsert: true, cacheControl: "3600" }),
    ]);
    if (tempUpload.error || savedUpload.error) throw new Error("The label matched, but its parcel photo could not be saved. Please retry.");
    const { error: photoRecordError } = await admin.from("parcel_label_scans").update({
      temp_object_path: objectPath,
      photo_object_path: savedObjectPath,
      temp_expires_at: expiresAt,
      photo_deleted_at: null,
    }).eq("id", scanId).eq("order_id", orderId).eq("scanned_by", userId);
    if (photoRecordError) {
      await admin.storage.from(TEMP_PHOTO_BUCKET).remove([objectPath]);
      await admin.storage.from(SAVED_PHOTO_BUCKET).remove([savedObjectPath]);
      throw new Error("The temporary parcel photo could not be secured. Please retry.");
    }

    return json({
      decision,
      scan_id: scanId,
      confidence,
      courier_slug: courierFromAwb(candidateAwb),
      tracking_number: candidateAwb,
      matched: { phone: true },
    });
  } catch (error) {
    console.error("[parcel-label-scan] unexpected", error);
    const status = Number((error as Error & { status?: number })?.status || 500);
    return json({ error: clean((error as Error)?.message || "Could not scan the parcel label", 240) }, status);
  }
});