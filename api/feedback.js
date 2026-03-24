// api/feedback.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL; // Set this in Vercel Dashboard

    if (!webhookUrl) return res.status(500).json({ message: 'Webhook not configured' });

    try {
        const { name, email, message } = req.body;
        const payload = {
            embeds: [{
                title: "🚀 New Feedback Received",
                color: 3447003, // BRACU Blue
                fields: [
                    { name: "Student Name", value: name || "Anonymous", inline: true },
                    { name: "Email", value: email || "Not provided", inline: true },
                    { name: "Message", value: message }
                ],
                footer: { text: `Sent via CGPA Dash • ${new Date().toLocaleString()}` }
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