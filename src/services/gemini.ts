export const geminiService = {
  async moderateText(text: string): Promise<boolean> {
    try {
      const res = await fetch('/api/gemini/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      return !!data.isInappropriate;
    } catch (error) {
      console.error('Error moderating text:', error);
      return false;
    }
  },

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const res = await fetch('/api/gemini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage })
      });
      const data = await res.json();
      return data.translated || text;
    } catch (error) {
      console.error('Error translating text:', error);
      return text;
    }
  },

  async getFriendSuggestions(userInterests: string[], othersInterests: Record<string, string[]>): Promise<string[]> {
    // This could also be proxied if needed, but for now we'll keep it simple or remove if unused
    return [];
  }
};
