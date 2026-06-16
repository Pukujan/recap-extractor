export class OpenRouterTextClient {
  constructor({ apiKey, baseUrl, model, fetchImpl = globalThis.fetch } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async extractLegalJson({ prompt, input, model } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || this.model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter Text API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    if (!content.startsWith("{") && !content.startsWith("[")) {
      throw new Error("OpenRouter Text returned markdown/prose response instead of strict JSON");
    }

    return JSON.parse(content);
  }
}
