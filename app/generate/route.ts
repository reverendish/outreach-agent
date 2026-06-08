import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { name, business, context } = await req.json();

  const prompt = `Write a short cold email from Ish, a developer based in Colchester who builds small automations for businesses. Business: ${business}. Director/contact name: ${name}. Extra context: ${context}.

Format:
Subject: [short subject line, title case, no ALL CAPS, max 8 words]

[greeting using first name if it looks like a person's name, otherwise "Hi there,"]

[2-3 sentences max. Be specific about what you could help with based on their industry. Sound like a real person. No buzzwords like streamline, leverage, synergy. No "I hope this finds you well". Don't mention AI in the first sentence.]

[one simple low-pressure question to end]

Output only the email. No commentary.`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const result = data.choices?.[0]?.message?.content ?? "Something went wrong.";
  return NextResponse.json({ result });
}
