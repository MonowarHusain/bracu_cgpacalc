export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return res.status(500).json({ message: 'Webhook not configured' });

    try {
        const { name, email, message } = req.body;
        
        // 1. Extract IP Address from Vercel headers
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || "Unknown";
        
        // 2. Get Location Data (Provided by Vercel)
        const city = req.headers['x-vercel-ip-city'] || "Unknown City";
        const country = req.headers['x-vercel-ip-country'] || "Unknown Country";

        // 3. Force Bangladesh Time (UTC+6)
        const bstTime = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "short",
            timeStyle: "medium"
        });

        const payload = {
            embeds: [{
                title: "🚀 New Feedback Received",
                color: 3447003,
                fields: [
                    { name: "Student Name", value: name || "Anonymous", inline: true },
                    { name: "Email", value: email || "Not provided", inline: true },
                    { name: "Message", value: message },
                    { name: "Network Info", value: `**IP:** ${ip}\n**Location:** ${city}, ${country}`, inline: false }
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
