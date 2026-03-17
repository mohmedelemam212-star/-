import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getIslamicStories(topic: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `أعطني قصة صحيحة وموثقة عن ${topic}. اجعل القصة مشوقة ومفيدة مع ذكر الدروس المستفادة. استخدم اللغة العربية الفصحى.`,
    config: {
      temperature: 0.7,
    },
  });
  return response.text;
}

export async function getDailyWisdom() {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "أعطني حكمة إسلامية قصيرة أو حديث نبوي شريف قصير لليوم مع شرح بسيط جداً.",
    config: {
      temperature: 0.8,
    },
  });
  return response.text;
}
