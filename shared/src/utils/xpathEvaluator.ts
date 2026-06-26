export class CustomXPathEvaluator {
  static evaluate(xml: string, xpath: string): string | null {
    if (!xml || !xpath) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        console.warn("XML Parse Error during XPath evaluation", parseError.textContent);
        return null;
      }

      const nsResolver = doc.createNSResolver(doc.documentElement);

      const result = doc.evaluate(xpath, doc, nsResolver, XPathResult.STRING_TYPE, null);
      return result.stringValue;
    } catch (e) {
      console.warn("XPath evaluation failed", e);
      return null;
    }
  }
}
