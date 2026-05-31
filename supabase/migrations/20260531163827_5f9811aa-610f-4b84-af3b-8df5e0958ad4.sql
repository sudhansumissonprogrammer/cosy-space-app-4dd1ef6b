DO $$
DECLARE
  v_store_id uuid := 'c3c5dff2-173a-4f4d-90e4-8b1c88c305d9';
  v_about text;
  v_shipping text;
  v_return text;
  v_about_html text;
  v_contact_html text;
BEGIN
  v_about :=
'About Imitation World

Welcome to Imitation World — your trusted destination for premium imitation jewellery and lifestyle accessories. We are passionate about bringing you carefully curated products with quality you can trust. Every item in our collection is hand-picked to ensure it meets our high standards of design, finish, and durability.

Our mission is simple — make shopping easy, affordable, and delightful for every customer. From fast delivery to friendly support, we are here for you at every step.

Business Owner
Owner / Proprietor: Sudhansu Sahoo
Email: sudhansusahoo7771@gmail.com
Primary Phone / WhatsApp: +91 9692282485
Alternate Phone: +91 9556582462
Registered Address: Rado, Dhorimana, Rajasthan – 344704, India
Website: https://imitationworld.in

Thank you for choosing Imitation World.';

  v_shipping :=
'Shipping & Delivery Policy

Thank you for shopping at Imitation World! Here is everything you need to know about how we ship your order.

Processing Time
Orders are processed within 1–3 business days after payment confirmation. Orders placed on weekends or public holidays are processed on the next business day.

Shipping Areas
We currently ship across India from Rado, Dhorimana, Rajasthan. For international shipping or bulk orders, please contact us using the details below.

Delivery Estimates
- Within Rajasthan: 2–4 business days
- Rest of India: 5–7 business days
- Remote / hill / North-East areas: 7–10 business days
Delivery times are estimates and may vary due to courier or weather conditions.

Shipping Charges
Shipping charges (if any) are calculated and shown at checkout. Free shipping may be offered on selected promotions or above a minimum order value.

Order Tracking
Once your order is dispatched, you will receive a tracking link via WhatsApp / SMS. You can also track the order from your account page.

Need Help?
For any shipping or delivery related query, please contact:
Owner: Sudhansu Sahoo
Email: sudhansusahoo7771@gmail.com
Phone / WhatsApp: +91 9692282485
Alternate: +91 9556582462
Address: Rado, Dhorimana, Rajasthan – 344704, India';

  v_return :=
'Return, Refund & Cancellation Policy

At Imitation World, customer satisfaction is our top priority. Please read our return, refund and cancellation policy carefully.

Eligibility for Return
- Return requests must be raised within 7 days of delivery.
- Product must be unused, in original packaging, with all tags intact.
- Damaged, defective or wrong items received are eligible for free replacement or refund.

Non-Returnable Items
- Items marked as "Final Sale" or "Non-Returnable".
- Products damaged due to misuse or wear after use.

How to Raise a Return
Contact us within 7 days of delivery with your order ID and a clear photo / video of the product:
Email: sudhansusahoo7771@gmail.com
WhatsApp: +91 9692282485
Alternate: +91 9556582462

Refund Process
- After we receive and inspect the returned item, refund is approved within 2 business days.
- Refunds are credited to the original payment method within 5–7 business days.
- For COD orders, refunds are processed to the bank account / UPI ID shared by the customer.

Order Cancellation
- Orders can be cancelled free of cost before they are dispatched.
- Once shipped, an order cannot be cancelled but can be returned as per the return policy above.

Contact for Returns & Refunds
Owner: Sudhansu Sahoo
Email: sudhansusahoo7771@gmail.com
Phone / WhatsApp: +91 9692282485
Alternate: +91 9556582462
Address: Rado, Dhorimana, Rajasthan – 344704, India';

  UPDATE public.stores
  SET
    owner_email = 'sudhansusahoo7771@gmail.com',
    about_us_text = v_about,
    shipping_policy = v_shipping,
    return_policy = v_return,
    updated_at = now()
  WHERE id = v_store_id;

  v_about_html :=
'<section style="max-width:900px;margin:0 auto;padding:24px 16px;line-height:1.7">'
|| '<h1 style="font-size:28px;font-weight:800;margin-bottom:16px">About Imitation World</h1>'
|| '<p>Welcome to <strong>Imitation World</strong> — your trusted destination for premium imitation jewellery and lifestyle accessories. Every product is hand-picked for design, finish and durability so you get the best value for every rupee.</p>'
|| '<p>Our mission is to make beautiful jewellery affordable and accessible to every customer in India, backed by friendly support and fast delivery.</p>'
|| '<h2 style="font-size:20px;font-weight:700;margin-top:24px;margin-bottom:12px">Business Owner & Contact</h2>'
|| '<ul style="list-style:none;padding:0;margin:0">'
|| '<li><strong>Owner / Proprietor:</strong> Sudhansu Sahoo</li>'
|| '<li><strong>Email:</strong> <a href="mailto:sudhansusahoo7771@gmail.com">sudhansusahoo7771@gmail.com</a></li>'
|| '<li><strong>Phone / WhatsApp:</strong> <a href="tel:+919692282485">+91 9692282485</a></li>'
|| '<li><strong>Alternate Phone:</strong> <a href="tel:+919556582462">+91 9556582462</a></li>'
|| '<li><strong>Address:</strong> Rado, Dhorimana, Rajasthan – 344704, India</li>'
|| '<li><strong>Website:</strong> <a href="https://imitationworld.in">https://imitationworld.in</a></li>'
|| '</ul>'
|| '<p style="margin-top:20px">Thank you for choosing Imitation World. ❤️</p>'
|| '</section>';

  v_contact_html :=
'<section style="max-width:900px;margin:0 auto;padding:24px 16px;line-height:1.7">'
|| '<h1 style="font-size:28px;font-weight:800;margin-bottom:8px">Contact Imitation World</h1>'
|| '<p>We would love to hear from you. Reach out using any of the channels below — we usually reply within a few hours.</p>'
|| '<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-top:20px">'
|| '<div style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px"><strong>Owner / Proprietor:</strong> Sudhansu Sahoo</div>'
|| '<div style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px"><strong>Email:</strong> <a href="mailto:sudhansusahoo7771@gmail.com">sudhansusahoo7771@gmail.com</a></div>'
|| '<div style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px"><strong>Phone / WhatsApp:</strong> <a href="tel:+919692282485">+91 9692282485</a></div>'
|| '<div style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px"><strong>Alternate Phone:</strong> <a href="tel:+919556582462">+91 9556582462</a></div>'
|| '<div style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px"><strong>Address:</strong> Rado, Dhorimana, Rajasthan – 344704, India</div>'
|| '<div style="padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px"><strong>Business Hours:</strong> Mon–Sat, 10:00 AM – 7:00 PM IST</div>'
|| '</div>'
|| '</section>';

  UPDATE public.store_pages
  SET title = 'About Us',
      content = v_about,
      custom_html = v_about_html,
      is_active = true,
      updated_at = now()
  WHERE store_id = v_store_id AND page_type IN ('about','about_us');

  IF EXISTS (SELECT 1 FROM public.store_pages WHERE store_id = v_store_id AND page_type = 'contact') THEN
    UPDATE public.store_pages
    SET title = 'Contact Us',
        custom_html = v_contact_html,
        is_active = true,
        updated_at = now()
    WHERE store_id = v_store_id AND page_type = 'contact';
  ELSE
    INSERT INTO public.store_pages (store_id, page_type, title, slug, custom_html, is_active)
    VALUES (v_store_id, 'contact', 'Contact Us', 'contact', v_contact_html, true);
  END IF;
END $$;