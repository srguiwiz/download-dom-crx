//

"use strict";

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.please === "nrvrDomSerialize") {
    var documentAsString = null; // default
    try {
      var serializer = new XMLSerializer();
      documentAsString = serializer.serializeToString(window.top.document);
    } catch (e) {
      console.error(e);
    } finally {
      sendResponse({ documentAsString:documentAsString });
    }
  } else {
    sendResponse(Object.assign(message, { problem:"not understood" }));
  }
});
