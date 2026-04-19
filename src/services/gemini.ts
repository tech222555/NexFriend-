import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const geminiService = {
  async moderateText(text: string): Promise<boolean> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following text for offensive language, hate speech, or inappropriate content. Return only "true" if it is inappropriate, and "false" if it is safe.
        Text: "${text}"`,
      });
      return response.text?.trim().toLowerCase() === 'true';
    } catch (error) {
      console.error('Error moderating text:', error);
      return false;
    }
  },

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text.
        Text: "${text}"`,
      });
      return response.text?.trim() || text;
    } catch (error) {
      console.error('Error translating text:', error);
      return text;
    }
  },

  async getFriendSuggestions(userInterests: string[], othersInterests: Record<string, string[]>): Promise<string[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on the user's interests: ${userInterests.join(', ')}, suggest which of the following users would be the best friends.
        Potential friends interests: ${JSON.stringify(othersInterests)}
        Return a comma-separated list of the user IDs.`,
      });
      return response.text?.split(',').map(id => id.trim()) || [];
    } catch (error) {
      console.error('Error getting friend suggestions:', error);
      return [];
    }
  }
};
