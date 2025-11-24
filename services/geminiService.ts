import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// We safely check if 'process' is defined to avoid ReferenceErrors in browser-only environments.
const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
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

export const generateAIReportMetadata = async (
  slideName: string, 
  annotations: any[]
): Promise<{ title: string, description: string }> => {
  if (!apiKey) {
    return { title: slideName, description: "" };
  }

  try {
    const modelId = 'gemini-2.5-flash';
    const annotationsList = annotations.map((a, i) => `Issue ${i + 1}: ${a.comment}`).join('\n');
    
    const prompt = `
      Analyze the following bug report observations and generate a concise Title and a detailed Description.
      
      Context: User is reporting a UI/UX bug on a web application.
      Slide Name: ${slideName}
      Observations:
      ${annotationsList}
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A short, descriptive summary (max 10 words)"
            },
            description: {
              type: Type.STRING,
              description: "A structured markdown description including a summary of issues."
            }
          },
          required: ["title", "description"],
          propertyOrdering: ["title", "description"]
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
        description: annotations.map((a, i) => `${i + 1}. ${a.comment}`).join('\n') 
    };
  }
};