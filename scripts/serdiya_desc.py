PROMISE = """\U0001F6E1\uFE0F Serdiya Jewellers Promise
\u2022 Cash on Delivery available across India
\u2022 Real product photos \u2014 what you see is what you get
\u2022 Safe, tamper-proof packaging
\u2022 Friendly WhatsApp support before and after your order

\U0001F525 Limited pieces in stock \u2014 order today before this design sells out!"""

def build(emoji, title, hook, love, details, wear, care, perfect):
    nl = chr(10)
    return f"""{emoji} {title}
{hook}

\U0001F48E Why You Will Love It
{nl.join('\u2022 ' + x for x in love)}

\U0001F4CB Product Details
{nl.join('\u2022 ' + x for x in details)}

\U0001F457 How To Wear & Fit
{nl.join('\u2022 ' + x for x in wear)}

\U0001F9FC Care Tips
{nl.join('\u2022 ' + x for x in care)}

\U0001F381 Perfect For
{perfect}

{PROMISE}"""

BASE_MAT = "Material: Skin-friendly brass alloy, nickel free \u2014 no itching, no rash"
BASE_FIN = "Finish: Micro gold polished \u2014 rich real-gold look, colour-safe"
BASE_QC  = "Quality: Hand-finished and checked piece by piece before packing"

T = []
def add(keys, *args):
    T.append((keys, build(*args)))

add(["mangalsutra"], "\U0001F5A4", "Gold Polished Mangalsutra",
 "A daily-wear mangalsutra with the shine of real gold \u2014 light on the neck, heavy on looks. \U0001F49B",
 ["Neat black-bead line that stays even and does not twist",
  "Light weight, so you can keep it on the whole day",
  "Pendant polished to look exactly like real gold"],
 [BASE_FIN, BASE_MAT, "Beads: Colour-locked black beads that do not fade", BASE_QC,
  "Closure: Strong lobster clasp with extra length loop"],
 ["Standard neck length that sits just below the collar",
  "Use the extension loop to shorten or lengthen the fall",
  "Wear the pendant centred and let the bead line rest flat"],
 ["Remove before bath, sleep and cooking steam",
  "Wipe beads and pendant with a dry cloth after wear",
  "Store in the pouch so beads do not rub the polish"],
 "Daily suhaag wear, office, festivals, karwa chauth and gifting to wife or bahu")

add(["rani har","ranihaar","rani-har","ranihar","jodha","har-","sohan","kanthi","hamail","tewt","tewat","chokar","chokhar","aad","hasli"], "\U0001F451", "Gold Polished Bridal Haar",
 "A royal long haar that gives a full bridal look at a fraction of real-gold cost. \U0001F49B",
 ["Big, rich bridal look in photos and in person",
  "Balanced weight \u2014 grand to see but comfortable to carry",
  "Matching earrings included in most sets for a complete look"],
 [BASE_FIN, BASE_MAT, "Stones: Firmly set kundan / AD stones, hand-pressed twice",
  BASE_QC, "Closure: Adjustable dori or hook so one size fits most"],
 ["Wear over a deep-neck blouse so the full design shows",
  "Tie the back dori firmly \u2014 the haar should sit flat, not swing",
  "Pair with a choker or maang tikka for a complete bridal set"],
 ["Wear last, after makeup and hairspray are fully dry",
  "Never pull the dori while stones are pressed against cloth",
  "Keep in the box, one piece per pouch, so stones do not scratch"],
 "Weddings, engagements, haldi and mehndi, bridal shoots and family functions")

add(["payal","anklet"], "\U0001F9B6", "Gold Polished Payal",
 "Light, jingling payal with a rich gold polish that suits both daily and festive wear. \U0001F49B",
 ["Soft ghungroo sound that is sweet, not loud",
  "Flexible links that move with your foot and do not poke",
  "Polish stays bright even with regular wear"],
 [BASE_FIN, BASE_MAT, "Sold as a pair", BASE_QC,
  "Closure: Easy hook with extension chain for a loose or snug fit"],
 ["Fasten just above the ankle bone with one finger of gap",
  "Use the extra chain links to adjust for a wider ankle",
  "Wear with saree, kurti, lehenga or jeans"],
 ["Remove before bathing \u2014 water dulls the polish fastest on feet",
  "Wipe off sweat with a dry cloth after wear",
  "Keep the pair together in one pouch"],
 "Daily wear, festivals, weddings, gifting and pooja occasions")

add(["kamarband","waist"], "\u2728", "Gold Polished Kamarband",
 "A statement waist belt that finishes a saree or lehenga look instantly. \U0001F49B",
 ["Grand, wide design with rich real-gold-look polish",
  "Adjustable dori so it fits a wide waist range",
  "Stays in place without digging into the waist"],
 [BASE_FIN, BASE_MAT, "Stones: Hand-set kundan / AD work, double secured", BASE_QC,
  "Fit: Adjustable dori / hook \u2014 fits most waist sizes"],
 ["Tie over the saree pleats or on the lehenga waistline",
  "Keep the main motif centred at the front or slightly to one side",
  "Tighten the dori while standing straight for the right fit"],
 ["Do not fold the belt sharply \u2014 store it flat or rolled",
  "Keep away from perfume sprayed on clothes",
  "Wipe with a dry cloth after every use"],
 "Weddings, sangeet, garba and navratri, bridal shoots and festive saree looks")

add(["hathful","hathphool","hathpanja","haithful","ponchi","gokhar","baju","armlet","bajuband"], "\U0001F91A", "Gold Polished Hand & Arm Jewellery",
 "Traditional hand and arm jewellery polished to look exactly like real gold. \U0001F49B",
 ["Detailed Rajasthani-style work that stands out in photos",
  "Elastic or dori fitting that adapts to your hand or arm",
  "Light enough to keep on through a full function"],
 [BASE_FIN, BASE_MAT, "Stones: Firmly set kundan / AD stones", BASE_QC,
  "Fit: Adjustable dori / elastic \u2014 fits most hand and arm sizes"],
 ["Slide the ring loop on the middle finger first, then fasten at the wrist",
  "For baju / bajuband, tie on the upper arm over the sleeve line",
  "Keep the design facing up and flat on the skin"],
 ["Wear after applying mehndi and lotion, never before",
  "Do not stretch the elastic more than needed",
  "Store flat in a pouch so the links do not tangle"],
 "Weddings, mehndi and haldi, bridal wear, garba and traditional shoots")

add(["nath"], "\U0001F4AB", "Gold Polished Nath",
 "A bridal nath that adds the final royal touch to your look. \U0001F49B",
 ["Traditional shape with fine gold polished detailing",
  "Light weight so it does not pull on the nose",
  "Chain support option keeps it steady all day"],
 [BASE_FIN, BASE_MAT, "Stones: Hand-set pearls / AD stones", BASE_QC,
  "Type: As shown in the photos \u2014 clip or pierced style"],
 ["Fix the nath first, then hook the support chain into your hair",
  "Keep the chain slightly loose so it does not tug",
  "Wear after the dupatta is set"],
 ["Clean only with a dry cloth \u2014 never with water",
  "Store separately so the wire does not bend",
  "Avoid sprays and makeup directly on the piece"],
 "Weddings, bridal looks, Rajasthani and traditional shoots and festivals")

add(["rakhdi","borla","maang","tikka","shisful","shishphool","matha"], "\U0001F338", "Gold Polished Maang Tikka Set",
 "Head jewellery that completes the bridal look from the very top. \U0001F49B",
 ["Rich gold polished motif that sits neat on the hair parting",
  "Strong hook that holds without slipping",
  "Matching pieces in the set for a full coordinated look"],
 [BASE_FIN, BASE_MAT, "Stones: Kundan / AD stones, double secured", BASE_QC,
  "Chain: Adjustable length with a firm hair hook"],
 ["Set your hair parting first, then place the motif on the forehead line",
  "Hook the chain into the hair just behind the parting",
  "Adjust the chain so the motif sits straight, not tilted"],
 ["Wear after hair oil and spray have dried",
  "Unhook gently to avoid pulling hair through the links",
  "Store flat so the chain does not knot"],
 "Weddings, engagements, bridal shoots, festivals and traditional functions")

add(["locket","pendant","\u0932\u0949\u0915\u0947\u091F","hanuman"], "\U0001F64F", "Gold Polished Locket",
 "A devotional locket with fine gold polish \u2014 perfect to wear daily with faith. \U0001F49B",
 ["Clear, sharp design detail you can actually see",
  "Smooth back and edges, comfortable against the skin",
  "Polish holds its shine with normal daily wear"],
 [BASE_FIN, BASE_MAT, "Bail: Wide opening \u2014 fits most chain thicknesses", BASE_QC,
  "Note: Locket only unless a chain is shown in the photos"],
 ["Slide onto a chain of your choice through the top loop",
  "Keep the design facing outward when you close the clasp",
  "Wear inside or outside the shirt as you prefer"],
 ["Remove before bath and swimming",
  "Wipe sweat off with a dry cloth after wear",
  "Do not use toothpaste or liquid cleaners on the polish"],
 "Daily faith wear, gifting, pooja days, birthdays and festivals")

add(["ad tops","tops","earring","jhumk","bali","kanpatta","\u0907\u092F\u0930","ear cup","stud"], "\U0001F442", "Gold Polished Earrings",
 "Earrings with a real-gold look and a light weight you can wear all day. \U0001F49B",
 ["Light on the ear lobe \u2014 no pulling, no pain",
  "AD stones set tight, no loose or missing stones",
  "Gold polish stays bright with normal wear"],
 [BASE_FIN, BASE_MAT, "Stones: Hand-set AD / kundan stones", BASE_QC,
  "Backing: Secure push-back or screw-back as shown in photos"],
 ["Push the back on firmly until it clicks and sits flat",
  "For heavier jhumkas, use an ear support patch for long functions",
  "Wear after your hair is fully set"],
 ["Remove before sleeping so the post does not bend",
  "Keep away from perfume, hair spray and shampoo",
  "Store as a pair in a pouch, not loose in a box"],
 "Daily wear, office, college, festivals, weddings and gifting")

add(["combo","full set","rakhdi-set","rakhdi set"], "\U0001F381", "Gold Polished Bridal Combo Set",
 "A complete matching set \u2014 everything in one order, nothing left to match later. \U0001F49B",
 ["All pieces share the same polish and stone tone, so nothing looks odd",
  "Costs less than buying each piece separately",
  "Ready-to-wear bridal look straight out of the box"],
 [BASE_FIN, BASE_MAT, "Includes: All pieces exactly as shown in the product photos",
  "Stones: Kundan / AD stones, hand-set and double secured", BASE_QC],
 ["Wear in order: haar, then choker, then head and hand pieces",
  "Adjust every dori while standing, with the outfit already worn",
  "Keep the heaviest piece for last so it sits over the rest"],
 ["Unbox and check every piece before the function day",
  "Store each piece in a separate pouch",
  "Wear only after makeup and sprays are dry"],
 "Weddings, bridal wear, engagement, reception and full traditional looks")

add(["bracelet","\u092C\u094D\u0930\u0947\u0938\u0932\u0947\u091F","kada","bangle","churi","chudi"], "\U0001FA99", "Gold Polished Bracelet",
 "A gold polished bracelet that looks premium on the wrist and stays comfortable all day. \U0001F49B",
 ["Smooth inner side \u2014 no scratching or catching on clothes",
  "Sturdy links and a secure clasp that will not open on its own",
  "Slim profile that sits well even with a watch"],
 [BASE_FIN, BASE_MAT, "Width: Balanced, exactly as shown in the photos",
  "Closure: Lobster clasp with extension chain for size adjustment", BASE_QC],
 ["Should sit loose enough to rotate but not slide over the hand",
  "Use the extension chain links to tighten or loosen the fit",
  "For a kada style, slide it over the narrowest part of the hand"],
 ["Remove for gym, swimming and frequent hand washing",
  "Wipe with a dry cloth after wear \u2014 wrist sweat dulls polish fastest",
  "Store separately so the clasp does not scratch other pieces"],
 "Daily wear, office, gifting, festivals and casual party looks")

add(["chain 2 ring","chain 1 ring","chain ring","chain,ring","chain 1,ring","bracelet ring","chain 2ring"], "\U0001F517", "Gold Polished Chain & Ring Combo",
 "Chain plus matching ring in one order \u2014 same polish, same tone, one complete look. \U0001F49B",
 ["Chain and ring are polished together so the shade matches exactly",
  "Cheaper as a combo than buying the two pieces separately",
  "Everyday-friendly weight for both pieces"],
 [BASE_FIN, BASE_MAT, "Includes: Chain and ring(s) exactly as shown in the photos",
  "Chain closure: Strong lobster clasp", "Ring size: Free / adjustable size", BASE_QC],
 ["Wear the chain at collar length and keep the clasp at the back",
  "Adjust the ring band only from the back, gently",
  "Works as a matched gift pair for husband, brother or son"],
 ["Remove both before bath, sweat-heavy work and sleep",
  "Wipe both with a dry cloth after wear",
  "Store the chain hooked so it does not knot with the ring"],
 "Daily wear, gifting, birthdays, festivals and office wear")

add(["anguthi","ring"], "\U0001F48D", "Gold Polished Ring",
 "A neat gold polished ring with a clean, real-gold-look finish. \U0001F49B",
 ["Comfortable band that does not press or mark the finger",
  "Smooth polished edges, safe for daily wear",
  "Stones set flush so they do not catch on clothes"],
 [BASE_FIN, BASE_MAT, "Stones: Hand-set AD stones where shown", BASE_QC,
  "Size: Free / adjustable size unless a size is mentioned on this page"],
 ["Adjustable rings can be gently opened or pressed for a snug fit",
  "Adjust only from the back of the band, never over the stone",
  "Fingers swell slightly in the evening \u2014 keep a small gap"],
 ["Remove before washing dishes, applying cream and sleeping",
  "Do not adjust the band again and again \u2014 it weakens the metal",
  "Wipe with a dry cloth after each wear"],
 "Daily wear, gifting, engagements, festivals and office wear")

add(["chain","pedal"], "\U0001F517", "Gold Polished Chain",
 "A gold polished chain that looks exactly like real gold \u2014 without the real-gold price. \U0001F49B",
 ["Even, smooth links with a rich real-gold-look shine",
  "Strong clasp that holds firmly through the day",
  "Colour-safe polish that does not turn dull quickly"],
 [BASE_FIN, BASE_MAT, "Links: Machine-set and hand-checked, no weak joints",
  "Closure: Strong lobster clasp", BASE_QC,
  "Note: Chain only unless a pendant is shown in the photos"],
 ["Standard neck length that sits at the collar line",
  "Keep the clasp at the back centre so the chain hangs straight",
  "Wear over or inside the shirt \u2014 the polish suits both"],
 ["Remove before bath, swimming and gym",
  "Wipe with a dry cloth after wear \u2014 sweat is the main enemy of polish",
  "Store hanging or in a pouch so the links do not knot"],
 "Daily wear, office, college, gifting, festivals and family functions")

DEFAULT = build("\U0001F49B", "Gold Polished Jewellery",
 "Gold polished jewellery crafted to look exactly like real gold \u2014 without the real-gold price. \U0001F49B",
 ["Rich real-gold-look polish on every piece",
  "Skin friendly and nickel free, safe for regular wear",
  "Hand-finished and checked before packing"],
 [BASE_FIN, BASE_MAT, "Stones: Hand-set where shown in the photos", BASE_QC,
  "Design: Exactly as shown in the product photos"],
 ["Wear as shown in the photos for the best look",
  "Adjust any dori or chain while wearing the outfit",
  "Pair with matching pieces for a complete set"],
 ["Keep away from water, perfume and sweat",
  "Wipe with a dry cloth after each wear",
  "Store in a separate pouch"],
 "Daily wear, gifting, festivals, weddings and family functions")

def q(s): return "'" + s.replace("'", "''") + "'"
cases = []
for keys, desc in T:
    cond = " OR ".join(f"lower(p.name) LIKE '%{k}%'" for k in keys)
    cases.append(f"WHEN ({cond}) THEN {q(desc)}")
nl = chr(10)
STORES = "('96dd4090-c3c8-431b-be1e-ab700dd3b30a','771a3012-393c-421a-b1c9-2ca918e6917f')"
sql = f"""CREATE TABLE IF NOT EXISTS public.product_desc_backup_serdiya_v2 AS
SELECT id, description, now() AS backed_up_at FROM public.products WHERE store_id IN {STORES};

UPDATE public.products p SET description = CASE
{nl.join(cases)}
ELSE {q(DEFAULT)} END, updated_at = now()
WHERE p.store_id IN {STORES};
"""
open('/tmp/serdiya_update.sql','w').write(sql)
print("sql bytes", len(sql))
