// serializeHTML.js

const SIGNIFICANT_WHITESPACE_TAGS = new Set([
  "pre",
  "code",
  "textarea",
  "script",
  "style",
  "samp",
  "kbd",
  "var",
  "span",
  "plaintext",
  "listing",
]);

function serializeHTML() {
  const documentClone = document.cloneNode(true);

  function processNode(node, parentIsSignificant = false) {
    const nodeType = node.nodeType;
    let isSignificant = parentIsSignificant;

    if (nodeType === Node.ELEMENT_NODE) {
      // Element node
      const tagName = node.tagName.toLowerCase();
      if (SIGNIFICANT_WHITESPACE_TAGS.has(tagName)) {
        isSignificant = true;
      }

      // Recursively process child nodes
      const childNodes = Array.from(node.childNodes);
      for (const child of childNodes) {
        processNode(child, isSignificant);
      }
    } else if (nodeType === Node.TEXT_NODE) {
      // Text node
      if (!isSignificant) {
        // Normalize whitespace for non-significant elements
        const text = node.nodeValue.trim().replace(/\s+/g, " ");
        node.nodeValue = text;
      }
      // Else, preserve whitespace for significant elements
    }
    // Ignore other node types (comments, etc.)
  }

  processNode(documentClone.body);

  // Serialize the document with proper formatting
  function serializeNode(node, parentIsSignificant = false) {
    const nodeType = node.nodeType;
    let isSignificant = parentIsSignificant;
    let output = "";

    if (nodeType === Node.ELEMENT_NODE) {
      // Element node
      const tagName = node.tagName.toLowerCase();
      if (SIGNIFICANT_WHITESPACE_TAGS.has(tagName)) {
        isSignificant = true;
      }

      // Start tag
      const attrs = [];
      for (const attr of node.attributes) {
        attrs.push(`${attr.name}="${attr.value}"`);
      }
      const attrString = attrs.length > 0 ? " " + attrs.join(" ") : "";
      output += `<${tagName}${attrString}>\n`;

      // Child nodes
      const childNodes = Array.from(node.childNodes);
      for (const child of childNodes) {
        const childOutput = serializeNode(child, isSignificant);
        if (childOutput !== null) {
          output += childOutput;
        }
      }

      // End tag
      output += `</${tagName}>\n`;
    } else if (nodeType === Node.TEXT_NODE) {
      // Text node
      const textContent = node.nodeValue;
      if (isSignificant) {
        output += textContent;
      } else {
        if (textContent.trim()) {
          output += `${textContent}\n`;
        }
      }
    }
    // Ignore other node types
    return output;
  }

  // Serialize the document starting from <html>
  const htmlElement = documentClone.documentElement;
  let outputHTML = serializeNode(htmlElement);

  // Get the doctype
  const doctype = document.doctype;
  let doctypeString = "";
  if (doctype) {
    const name = doctype.name;
    const publicId = doctype.publicId ? ` PUBLIC "${doctype.publicId}"` : "";
    const systemId = doctype.systemId ? ` "${doctype.systemId}"` : "";
    doctypeString = `<!DOCTYPE ${name}${publicId}${systemId}>\n`;
  }

  // Post-process to remove unwanted blank lines and leading spaces
  const lines = outputHTML.split("\n");
  const newLines = [];
  let insideSignificant = false;

  for (let line of lines) {
    if (line.trim() === "") {
      continue; // Skip empty lines
    }

    const strippedLine = line.trimStart();

    // Check if we're entering a significant whitespace element
    if (SIGNIFICANT_WHITESPACE_TAGS.has(strippedLine.match(/^<(\w+)/)?.[1])) {
      insideSignificant = true;
    }

    if (!insideSignificant) {
      newLines.push(strippedLine);
    } else {
      newLines.push(line);
    }

    // Check if we're exiting a significant whitespace element
    if (SIGNIFICANT_WHITESPACE_TAGS.has(strippedLine.match(/^<\/(\w+)/)?.[1])) {
      insideSignificant = false;
    }
  }

  // Add the doctype at the beginning
  return doctypeString + newLines.join("\n");
}

export default serializeHTML;
