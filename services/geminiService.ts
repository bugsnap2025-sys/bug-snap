import { GoogleGenAI, Type } from "@google/genai";

// Safely retrieve API Key to prevent "process is not defined" crashes in browser
const getApiKey = () => {
  try {
    return typeof process !== 'undefined' ? process.env.API_KEY : undefined;
  } catch (e) {
    return undefined;
  }
};

const API_KEY = getApiKey();

// Initialize Gemini Client
// We pass an empty string if undefined to allow the app to load, though API calls will fail gracefully later
const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

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
    
    // If no annotations, provide generic context
    if (!annotations || annotations.length === 0) {
        return { 
            title: slideName || "Bug Report", 
            description: "No specific annotations provided. Please review the attached screenshot." 
        };
    }

    const annotationsList = annotations.map((a: any, i: number) => `Issue ${i + 1}: ${a.comment}`).join('\n');
    
    const prompt = `
      You are an expert QA Lead. 
      Analyze the following list of bug observations/annotations from a screenshot and generate a concise Task Title and Description.

      Input Context (User Comments):
      ${annotationsList}

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
        return JSON.parse(text);
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