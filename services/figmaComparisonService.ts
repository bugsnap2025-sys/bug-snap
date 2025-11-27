import { GoogleGenAI, Type } from "@google/genai";

interface ComparisonResult {
  matchScore: number; // 0-100
  improvements: Array<{
    category: string;
    severity: 'critical' | 'major' | 'minor';
    description: string;
    suggestion: string;
  }>;
  summary: string;
  detailedAnalysis: string;
}

// Helper to safely get the API Key
const getApiKey = (): string | undefined => {
  let key: string | undefined = undefined;

  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // ignore
  }

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

/**
 * Compares a screenshot with a Figma design using AI vision
 */
export const compareWithFigma = async (
  screenshotDataUrl: string,
  figmaDesignDataUrl: string,
  context?: string
): Promise<ComparisonResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key missing. Please set VITE_API_KEY in your environment.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelId = 'gemini-2.5-flash'; // Use vision-capable model

    // Convert data URLs to base64 (remove data:image/png;base64, prefix)
    const screenshotBase64 = screenshotDataUrl.split(',')[1];
    const figmaBase64 = figmaDesignDataUrl.split(',')[1];

    const prompt = `
You are an expert UI/UX designer and QA specialist. Compare the implementation screenshot with the Figma design.

Analyze:
1. Layout accuracy (spacing, alignment, positioning)
2. Typography (font sizes, weights, line heights)
3. Colors (hex codes, gradients, opacity)
4. Component styling (buttons, inputs, cards, etc.)
5. Spacing and padding consistency
6. Visual hierarchy
7. Missing elements or extra elements
8. Responsive behavior (if applicable)

${context ? `Additional Context: ${context}` : ''}

Provide a comprehensive analysis with:
- A match score (0-100) indicating how closely the implementation matches the design
- A list of improvements categorized by severity (critical, major, minor)
- Each improvement should have: category, severity, description, and actionable suggestion
- A summary paragraph
- Detailed analysis

Return JSON format.
`;

    // Use Gemini's vision API format
    // The SDK supports multimodal content with inline data
    // Format: array of parts with text and inlineData
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: figmaBase64
              }
            },
            {
              inlineData: {
                mimeType: 'image/png',
                data: screenshotBase64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: {
              type: Type.NUMBER,
              description: "Match score from 0-100 indicating how closely the implementation matches the Figma design"
            },
            improvements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description: "Category of the issue (e.g., 'Layout', 'Typography', 'Colors', 'Spacing')"
                  },
                  severity: {
                    type: Type.STRING,
                    enum: ['critical', 'major', 'minor'],
                    description: "Severity level of the issue"
                  },
                  description: {
                    type: Type.STRING,
                    description: "Description of what doesn't match"
                  },
                  suggestion: {
                    type: Type.STRING,
                    description: "Actionable suggestion to fix the issue"
                  }
                },
                required: ["category", "severity", "description", "suggestion"]
              }
            },
            summary: {
              type: Type.STRING,
              description: "A brief summary paragraph of the overall comparison"
            },
            detailedAnalysis: {
              type: Type.STRING,
              description: "Detailed analysis of the differences"
            }
          },
          required: ["matchScore", "improvements", "summary", "detailedAnalysis"]
        }
      }
    });

    const text = response.text;
    if (text) {
      // Sanitize response: Remove any markdown code blocks if present
      const sanitized = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result: ComparisonResult = JSON.parse(sanitized);
      
      // Ensure matchScore is within bounds
      result.matchScore = Math.max(0, Math.min(100, result.matchScore || 0));
      
      return result;
    }

    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Figma comparison failed:", error);
    
    // Return a fallback result
    return {
      matchScore: 0,
      improvements: [{
        category: 'Error',
        severity: 'critical',
        description: 'Failed to analyze the comparison',
        suggestion: 'Please check your API key and try again'
      }],
      summary: 'Analysis failed. Please try again.',
      detailedAnalysis: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

