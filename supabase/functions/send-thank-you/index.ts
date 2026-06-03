import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const payload = await req.json()
    const donor_name = payload.donor_name || payload.record?.donor_name
    const donor_email = payload.donor_email || payload.record?.donor_email
    const charity_name = payload.charity_name || payload.record?.charity_name
    const amount = payload.amount || payload.record?.amount
    const date = payload.date || new Date(payload.record?.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    const isNricRequest = payload.request_nric === true

    if (!donor_email) {
      return new Response(JSON.stringify({ error: 'No donor email provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const subject = isNricRequest
      ? `Action Required: Provide NRIC for tax deduction — ${charity_name}`
      : `Thank you for your donation to ${charity_name}! 💚`

    const html = isNricRequest ? `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FAF7F2;">
        <div style="background: #1B4332; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🏛️</div>
          <div style="font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px;">Action Required</div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.7);">Provide your NRIC to claim your tax deduction</div>
        </div>
        <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1.5px solid #E2D9CC;">
          <p style="font-size: 14px; color: #1C1C1C; line-height: 1.6; margin-bottom: 16px;">Dear ${donor_name},</p>
          <p style="font-size: 14px; color: #1C1C1C; line-height: 1.6; margin-bottom: 16px;">Thank you for your donation of <strong>SGD $${amount}</strong> to <strong>${charity_name}</strong> on ${date}.</p>
          <p style="font-size: 14px; color: #1C1C1C; line-height: 1.6; margin-bottom: 16px;">To qualify for the <strong>250% tax deduction</strong>, we need your NRIC/FIN number. Please log in to your GiveBack SG profile and update your NRIC under the Profile tab.</p>
          <div style="background: #EEF6F1; border-radius: 12px; padding: 16px; border: 1px solid #74C69D;">
            <div style="font-size: 13px; font-weight: 700; color: #1B4332; margin-bottom: 4px;">Why is this needed?</div>
            <div style="font-size: 13px; color: #40916C; line-height: 1.5;">IRAS requires your NRIC/FIN to automatically apply the 250% tax deduction to your income tax assessment. Without it, you will not receive the tax benefit.</div>
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #7A6E62; line-height: 1.6;">
          This email was sent via <strong>GiveBack SG</strong> on behalf of ${charity_name}.
        </div>
      </div>
    ` : `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FAF7F2;">
        <div style="background: #1B4332; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 12px;">💚</div>
          <div style="font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px;">Thank You, ${donor_name}!</div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.7);">Your generosity makes a difference</div>
        </div>
        <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1.5px solid #E2D9CC;">
          <div style="font-size: 13px; color: #7A6E62; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; font-weight: 600;">Donation Details</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-size: 14px; color: #7A6E62;">Charity</span>
            <span style="font-size: 14px; font-weight: 700; color: #1B4332;">${charity_name}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-size: 14px; color: #7A6E62;">Amount</span>
            <span style="font-size: 14px; font-weight: 700; color: #40916C;">SGD $${amount}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 14px; color: #7A6E62;">Date</span>
            <span style="font-size: 14px; font-weight: 700; color: #1B4332;">${date}</span>
          </div>
        </div>
        <div style="background: #EEF6F1; border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1.5px solid #74C69D;">
          <div style="font-size: 13px; font-weight: 700; color: #1B4332; margin-bottom: 8px;">💡 Tax Deduction Reminder</div>
          <div style="font-size: 13px; color: #40916C; line-height: 1.6;">Your donation is eligible for a 250% tax deduction under Singapore tax law. Make sure your NRIC is updated in your GiveBack SG profile to receive this benefit automatically.</div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #7A6E62; line-height: 1.6;">
          This receipt was sent via <strong>GiveBack SG</strong> on behalf of ${charity_name}.<br/>
          All charities on GiveBack SG are IPC-registered.
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'GiveBack SG <onboarding@resend.dev>',
        to: [donor_email],
        subject,
        html,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})