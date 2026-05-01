import { debugWarn } from "./logger";

export class CustomXPathEvaluator {
  static evaluate(xml: string, xpath: string): string | null {
    if (!xml || !xpath) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      // Check for parse errors
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        debugWarn(
          "XML Parse Error during XPath evaluation",
          parseError.textContent,
        );
        return null;
      }

      // Create a namespace resolver that adapts to the document
      const nsResolver = doc.createNSResolver(doc.documentElement);

      // Evaluate
      const result = doc.evaluate(
        xpath,
        doc,
        nsResolver,
        XPathResult.STRING_TYPE,
        null,
      );
      return result.stringValue;
    } catch (e) {
      debugWarn("XPath evaluation failed", e);
      return null;
    }
  }
}
