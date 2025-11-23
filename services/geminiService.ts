import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Using the provided fallback key safely. 
// In a real Vite env, use import.meta.env.VITE_API_KEY, but hardcoding provided key for stability.
const apiKey = 'AIzaSyBOOzzdxkWdA-Oqr2HPS-ejS2q2Ykf168w'; 
const ai = new GoogleGenAI({ apiKey });

export const refineBugReport = async (rawText: string, context: string = "general"): Promise<string> => {
  if (!apiKey) {
    console.warn("Gemini API Key missing. Returning raw text.");
    return rawText; 
  }

  try {
    const modelId = 'gemini-2.5-flash';
    const prompt = `
      You are a QA specialist helper. Rewrite the following bug report comment to be professional, concise, and actionable for developers. 
      Fix grammar and ensure clarity.
      
      Context: ${context}
      Input: "${rawText}"
      
      Return ONLY the refined text.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text ? response.text.trim() : rawText;
  } catch (error) {
    console.error("Gemini refinement failed:", error);
    return rawText;
  }
};

export const generateMarkdownReport = async (slideTitle: string, annotations: any[]): Promise<string> => {
  if (!apiKey) return "";

  try {
    const modelId = 'gemini-2.5-flash';
    const annotationsList = annotations.map((a, i) => `${i + 1}. ${a.comment}`).join('\n');
    
    const prompt = `
      Create a structured Markdown bug report based on these details:
      Title: ${slideTitle}
      Observations:
      ${annotationsList}

      Format it with headers: ## Summary, ## Steps/Observations.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Markdown generation failed:", error);
    return "Error generating report.";
  }
};