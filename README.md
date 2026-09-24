# Pellet Webshop Demo v2

Polish-language static webshop demo, designed for Cloudflare Pages and a later Shopify integration.

## Features

- Paged-inspired editorial / industrial visual direction
- 15 kg pellet bags
- Commercial package anchors:
  - 5 bags — 365 PLN
  - 32 bags — 1,340 PLN
  - 65 bags / full pallet — 2,350 PLN
- Quantity selector with automatic price calculation
- Cart
- Pickup vs delivery
- Customer order form
- Cloudflare Pages Function endpoint: `/api/order`
- Resend email integration
- No payment processing

## Deploy to Cloudflare Pages

Upload this project to a Git repository and create a Cloudflare Pages project from it.

No build command is required.

Output/build directory:
`/`

Cloudflare Pages automatically detects `functions/api/order.js` as a Pages Function.

## Email configuration

Set these Cloudflare environment variables:

- `RESEND_API_KEY` — your Resend API key
- `ORDER_EMAIL` — email address that should receive orders
- `ORDER_FROM` — verified sender, e.g. `orders@yourdomain.pl`

For production, use a verified domain in Resend.

## Important commercial logic

The prices above are based on the competitor prices supplied for the mockup. They are not yet confirmed prices for the client's own product.

Delivery is intentionally **not priced in the demo**. The customer selects delivery and provides a postcode; the final transport price is to be confirmed.

## Shopify path

The frontend is deliberately kept simple so the product data can later be moved to Shopify:

- product title
- 15 kg unit weight
- package/quantity tiers
- cart quantity
- fulfilment method
- customer details

For production, Shopify should become the source of truth for products, inventory, orders and checkout.

## Email workflow

After checkout, two separate emails are sent through Resend:

1. **Internal email** to `ORDER_EMAIL` with the full order and customer details.
2. **Customer confirmation** to the email entered in the checkout form, containing the order number and all order details.

Every submission gets a demo order number such as:
`PEL-20260918-A1B2C3`

For production Shopify, Shopify's order ID/number should become the source of truth instead.
