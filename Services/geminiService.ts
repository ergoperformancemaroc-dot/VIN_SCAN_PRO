import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

export const extractVehicleData = async (base64Image: string): Promise<GeminiResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Extraire le NIV (17 chars), Marque, Modèle, Année. Répondre uniquement en JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vin: { type: Type.STRING },
            make: { type: Type.STRING },
            model: { type: Type.STRING },
            year: { type: Type.STRING },
          },
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    return { error: "Erreur d'analyse IA" };
  }
};

export const extractLocationData = async (base64Image: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Extraire uniquement le code court d'emplacement sur cette image." }
        ]
      }
    });
    return (response.text || "").trim().substring(0, 15);
  } catch (error) {
    return "";
  }
};