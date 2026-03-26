export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return res.status(500).json({ message: 'Webhook not configured' });

    try {
        const { name, email, message, device } = req.body;
        
        // 1. Network & Location Data (Vercel Headers)
        const ip = req.headers['x-forwarded-for'] || "Unknown";
        const city = req.headers['x-vercel-ip-city'] || "Unknown City";
        const region = req.headers['x-vercel-ip-country-region'] || "Unknown Region";
        const country = req.headers['x-vercel-ip-country'] || "Unknown Country";
        const lat = req.headers['x-vercel-ip-latitude'] || "0";
        const lon = req.headers['x-vercel-ip-longitude'] || "0";

        // 2. Format Bangladesh Time
        const bstTime = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "short",
            timeStyle: "medium"
        });

        const payload = {
            embeds: [{
                title: "🚀 Detailed Feedback Received",
                color: 3447003,
                fields: [
                    { name: "👤 Student Info", value: `**Name:** ${name || "Anon"}\n**Email:** ${email || "None"}`, inline: true },
                    { name: "📍 Location", value: `**IP:** ${ip}\n**Place:** ${city}, ${region}, ${country}\n**Map:** [Google Maps](https://www.google.com/maps?q=${lat},${lon})`, inline: true },
                    { name: "💬 Message", value: message || "No content.", inline: false },
                    { name: "💻 Device Metadata", value: `**Browser/OS:** ${device.ua}\n**Resolution:** ${device.screen}\n**Language:** ${device.lang}`, inline: false }
                ],
                footer: { text: `Sent via CGPA Dash • ${bstTime}` }
            }]
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return response.ok ? res.status(200).json({ success: true }) : res.status(500).send();
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
