
import { GoogleGenAI, Type } from "@google/genai";
import { Opportunity, User } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const fetchLiveOpportunities = async (query: string): Promise<Opportunity[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find 5 currently open career opportunities (internships, hackathons, or graduate roles) in India for ${query} students. 
      Return them as a JSON array of objects.
      Each object must have: id (unique string), title, company, type (one of: Internship, Hackathon, Workshop, Competition, Full-time), deadline (YYYY-MM-DD), description, tags (array of strings), location, postedDate (YYYY-MM-DD), eligibility, requirements (array of strings).
      Ensure the opportunities are REAL and active in 2024 or 2025.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              type: { type: Type.STRING },
              deadline: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              location: { type: Type.STRING },
              postedDate: { type: Type.STRING },
              eligibility: { type: Type.STRING },
              requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["id", "title", "company", "type", "deadline", "description", "tags", "location", "postedDate", "eligibility", "requirements"]
          }
        }
      },
    });

    const results = JSON.parse(response.text || "[]") as any[];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return results.map((res, index) => ({
      ...res,
      groundingChunks: groundingChunks.slice(index, index + 1) // Attach source if available
    }));
  } catch (error) {
    console.error("Live fetch failed:", error);
    return [];
  }
};

export const getCareerAdvice = async (user: User, opportunity: Opportunity) => {
  try {
    const prompt = `Act as a senior career counselor at KEC. 
    A student named ${user.name} with skills [${user.skills.join(', ')}] is interested in: 
    "${opportunity.title}" at "${opportunity.company}". 
    
    Provide 3 specific tips to improve chances. Use grounding if possible.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "No advice available.";
  } catch (error) {
    return "Error getting advice.";
  }
};

export const generateApplicationDraft = async (user: User, opportunity: Opportunity) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a professional cover letter for ${user.name} for ${opportunity.title} at ${opportunity.company}. Skills: ${user.skills.join(', ')}.`,
    });
    return response.text || "Draft failed.";
  } catch (error) {
    return "Error generating draft.";
  }
};
