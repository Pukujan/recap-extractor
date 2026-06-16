export class OpenRouterVisionClient {
  constructor({ apiKey, baseUrl, model, fetchImpl = globalThis.fetch } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async parsePageImage({ imageBase64, prompt } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter Vision API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    if (!content.startsWith("{") && !content.startsWith("[")) {
      throw new Error("OpenRouter Vision returned markdown-wrapped JSON instead of strict JSON");
    }

    return JSON.parse(content);
  }
}
