import { GoogleGenAI, Type } from "@google/genai";

// Retrieve API Key safely.
// We access process.env.API_KEY directly so build tools can replace it with the string literal.
// We wrap in try-catch to handle cases where 'process' is not defined (browser runtime)
// and the build tool did NOT replace the variable (missing env var).
let API_KEY = "";
try {
  API_KEY = process.env.API_KEY || "";
} catch (e) {
  // process is undefined and replacement didn't happen
  console.warn("API_KEY environment variable not detected.");
}

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const refineBugReport = async (rawText: string, context: string = "general"): Promise<string> => {
  if (!API_KEY) {
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
  if (!API_KEY) return "";

  try {
    const modelId = 'gemini-2.5-flash';
    const annotationsList = annotations.map((a: any, i: number) => `${i + 1}. ${a.comment}`).join('\n');
    
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

export const generateAIReportMetadata = async (
  slideName: string, 
  annotations: any[]
): Promise<{ title: string, description: string }> => {
  if (!API_KEY) {
    return { title: slideName, description: "" };
  }

  try {
    const modelId = 'gemini-2.5-flash';
    
    // Provide a default context if annotations are empty, so the model still generates a good title/description
    const contextList = (annotations && annotations.length > 0) 
        ? annotations.map((a: any, i: number) => `Issue ${i + 1}: ${a.comment}`).join('\n')
        : "No specific text comments provided. The user annotated the screen with a visual shape (Rectangle/Circle).";

    const prompt = `
      You are an expert QA Lead. 
      Analyze the following list of bug observations/annotations from a screenshot and generate a concise Task Title and Description.

      Input Context (User Comments):
      ${contextList}

      Requirements:
      1. Title: Short, descriptive, and punchy (max 60 chars). Focus on the main issue found in the comments.
      2. Description: A professional summary. Group related observations if necessary. Use Markdown.

      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A short, descriptive summary (max 10 words)" },
            description: { type: Type.STRING, description: "A structured markdown description." }
          },
          required: ["title", "description"]
        }
      }
    });

    const text = response.text;
    if (text) {
        // Sanitize response: Remove any markdown code blocks if present (e.g. ```json ... ```)
        const sanitized = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(sanitized);
    }
    throw new Error("Empty response");

  } catch (error) {
    console.error("AI Metadata generation failed:", error);
    // Fallback
    return { 
        title: slideName, 
        description: annotations.map((a: any, i: number) => `${i + 1}. ${a.comment}`).join('\n') 
    };
  }
};