//

"use strict";

var lineBreakRegExp = /(\r\n|\r|\n)/

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.please === "nrvrDomSerialize") {
    var documentAsString = null; // default
    var contentType = null; // default
    try {
      var documentToSerialize = window.top.document;
      var documentElement = documentToSerialize.documentElement;
      var mode = "XMLSerializer"; // default
      if ( message.respectHTMLIsNotXML // an option
        && documentElement.tagName === "HTML"
        && !documentElement.getAttribute("xmlns")
        && (!documentToSerialize.doctype || documentToSerialize.doctype.name === "html")) {
        mode = "outerHTML";
      }
      //
      switch (mode) {
        case "XMLSerializer": // original case
          var serializer = new XMLSerializer();
          documentAsString = serializer.serializeToString(documentToSerialize);
          break;
        case "outerHTML":
          documentAsString = documentElement.outerHTML;
          var lineBreakRegExpMatch = lineBreakRegExp.exec(documentAsString);
          var lineBreak = lineBreakRegExpMatch ? lineBreakRegExpMatch[1] : "\n";
          if (documentToSerialize.doctype) {
            documentAsString =
              "<!DOCTYPE " + documentToSerialize.doctype.name + ">" + lineBreak + documentAsString;
          }
          break;
      }
      contentType = documentToSerialize.contentType;
    } catch (e) {
      console.error(e);
    } finally {
      sendResponse({ documentAsString, contentType });
    }
  } else {
    sendResponse(Object.assign(message, { problem:"not understood" }));
  }
});
