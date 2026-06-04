cat << 'EOF'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
  if (!timestamp || !v1) return false;
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === v1;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const body = await req.text();

  const valid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(body);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const shop_id = session.metadata?.shop_id;
        const plugin_id = session.metadata?.plugin_id;
        const subscription_id = session.subscription;
        const customer_id = session.customer;
        if (!shop_id || !plugin_id) break;
        await supabase.from("shop_plugin_subscriptions").upsert({
          shop_id, plugin_id,
          stripe_subscription_id: subscription_id,
          stripe_customer_id: customer_id,
          status: "active",
          current_period_end: null,
        }, { onConflict: "shop_id,plugin_id" });
        break;
      }
      case "customer.subscription.updated":
      case "invoice.payment_succeeded": {
        const sub = event.data.object;
        const sub_id = sub.id || sub.subscription;
        if (!sub_id) break;
        const period_end = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        await supabase.from("shop_plugin_subscriptions").update({ status: "active", current_period_end: period_end }).eq("stripe_subscription_id", sub_id);
        break;
      }
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const sub = event.data.object;
        const sub_id = sub.id || sub.subscription;
        if (!sub_id) break;
        await supabase.from("shop_plugin_subscriptions").update({ status: "canceled" }).eq("stripe_subscription_id", sub_id);
        break;
      }
    }
  } catch (e) {
    console.error("Handler error:", e);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
EOF
