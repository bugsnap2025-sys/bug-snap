
import { GoogleGenAI, Type } from "@google/genai";

// Helper to safely get the API Key in both Dev and Prod (Browser) environments
const getApiKey = (): string | undefined => {
  let key: string | undefined = undefined;

  // 1. Try standard Vite injection (Recommended for Vercel + Vite)
  // @ts-ignore - import.meta is a valid meta-property in Vite/ESM
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // ignore
  }

  // 2. Try process.env (Node.js or Bundler Replaced String)
  // We MUST access process.env.API_KEY directly inside try-catch to allow bundlers 
  // to replace it with the string literal, while catching ReferenceError in browser if not replaced.
  if (!key) {
    try {
      // @ts-ignore
      if (process.env.API_KEY) {
        // @ts-ignore
        key = process.env.API_KEY;
      }
    } catch (e) {
      // process is not defined, ignore
    }
  }

  return key;
};

export const refineBugReport = async (rawText: string, context: string = "general"): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("Gemini API Key missing. Please set VITE_API_KEY in your environment.");
    return rawText; 
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
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
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
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
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("Gemini API Key missing. Returning default metadata.");
    return { title: slideName, description: "" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
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

export interface DetectedIssue {
    coordinates: number[]; // [ymin, xmin, ymax, xmax] 0-1000
    suggestion: string;
    explanation: string;
}

export const scanImageForIssues = async (base64Image: string): Promise<DetectedIssue[]> => {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn("Gemini API Key missing.");
      return [];
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        // Using pro-image model or flash-lite-latest which supports bounding boxes well
        const modelId = 'gemini-2.5-flash'; 
        
        // Strip data:image prefix if present for pure base64
        const pureBase64 = base64Image.split(',')[1] || base64Image;

        const prompt = `
            Analyze this image for grammatical errors, spelling mistakes, typos, and awkward phrasing in the visible text.
            
            Return a JSON object containing a list of issues found.
            For each issue, strictly provide:
            1. 'coordinates': A bounding box [ymin, xmin, ymax, xmax] normalized to a 1000x1000 scale.
            2. 'original': The text containing the error.
            3. 'suggestion': The corrected text.
            4. 'explanation': A very brief reason (e.g., "Spelling error", "Grammar fix").

            If no text issues are found, return an empty list.
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: pureBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        issues: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    coordinates: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                                    original: { type: Type.STRING },
                                    suggestion: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        
        const json = JSON.parse(text);
        return json.issues || [];

    } catch (error) {
        console.error("AI Visual Scan failed:", error);
        return [];
    }
};
