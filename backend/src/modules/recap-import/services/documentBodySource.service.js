const MIN_BODY_TEXT_CHARS = 500;
const MIN_OCR_TEXT_CHARS = 300;

export function chooseDocumentBodySource({
  courtListenerPlainText,
  pdfEmbeddedText,
  qwenVisionText,
  metadataText,
} = {}) {
  if (courtListenerPlainText && courtListenerPlainText.trim().length > 0) {
    const text = courtListenerPlainText;
    return {
      extractionSource: 'courtlistener_plain_text',
      text,
      bodyTextAvailable: true,
      bodyTextLength: text.trim().length,
      metadataOnly: false,
      pageImageCount: 0,
    };
  }

  if (pdfEmbeddedText && pdfEmbeddedText.trim().length >= MIN_BODY_TEXT_CHARS) {
    const text = pdfEmbeddedText;
    return {
      extractionSource: 'pdf_embedded_text',
      text,
      bodyTextAvailable: true,
      bodyTextLength: text.trim().length,
      metadataOnly: false,
      pageImageCount: 0,
    };
  }

  if (qwenVisionText && qwenVisionText.trim().length >= MIN_OCR_TEXT_CHARS) {
    const text = qwenVisionText;
    return {
      extractionSource: 'qwen_vl_ocr',
      text,
      bodyTextAvailable: true,
      bodyTextLength: text.trim().length,
      metadataOnly: false,
      pageImageCount: 0,
    };
  }

  const text = metadataText || '';
  return {
    extractionSource: 'metadata_only',
    text,
    bodyTextAvailable: false,
    bodyTextLength: text.trim().length,
    metadataOnly: true,
    pageImageCount: 0,
  };
}
