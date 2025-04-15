//
// Simplified BSD License
//
// Copyright (c) 2012-2025, Nirvana Research
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// ==============================================================================
//
// the main module of the Download Serialized DOM Extension
//
// ==============================================================================
//
// Idea and first implementation - Leo Baschy <srguiwiz12 AT nrvnr DOT com>
//

const defaultOnlyIfURIMatchesRegEx = "^.+$";

var onlyIfURIMatchesRegEx = defaultOnlyIfURIMatchesRegEx;
var onlyIfURIMatchesRegExp = new RegExp(onlyIfURIMatchesRegEx);
var showFileChooserDialog = true;
var resultNameSuffix = "-result-utc()"
var ifConflictThen = "uniquify";
var respectHTMLIsNotXML = true;

const validIfConflictThenSet = new Set(["uniquify","overwrite"]);
function validIfConflictThen(ifConflictThen) {
  if (validIfConflictThenSet.has(ifConflictThen)) return ifConflictThen;
  return "uniquify"; // default
}

// a required friendly string description of the action button used for
// accessibility, title bars, and error reporting
var friendlyName = "Download Serialized DOM";

function onError(error) {
  console.error(`${error}`);
}

function onExtensionLastError() {
  if (chrome.extension.lastError) {
    console.error(`${chrome.extension.lastError}`);
  }
}

function onRuntimeLastError() {
  if (chrome.runtime.lastError) {
    console.error(`${chrome.runtime.lastError}`);
  }
}

function retrieveOptions() {
  chrome.storage.local.get({
    "onlyIfURIMatchesRegEx":onlyIfURIMatchesRegEx,
    "showFileChooserDialog":showFileChooserDialog,
    "resultNameSuffix":resultNameSuffix,
    "ifConflictThen":ifConflictThen,
    "respectHTMLIsNotXML":respectHTMLIsNotXML,
  }, got => {
    if (got.onlyIfURIMatchesRegEx) {
      onlyIfURIMatchesRegEx = got.onlyIfURIMatchesRegEx;
      onlyIfURIMatchesRegExp = new RegExp(onlyIfURIMatchesRegEx);
      showFileChooserDialog = got.showFileChooserDialog;
      resultNameSuffix = got.resultNameSuffix || "";
      ifConflictThen = validIfConflictThen(got.ifConflictThen);
      respectHTMLIsNotXML = got.respectHTMLIsNotXML;
    }
  });
}
chrome.runtime.onInstalled.addListener(retrieveOptions);

function onStorageChange(changes, area) {
  var changedItems = new Set(Object.keys(changes));
  if (changedItems.has("onlyIfURIMatchesRegEx")) {
    onlyIfURIMatchesRegEx = changes.onlyIfURIMatchesRegEx.newValue;
    onlyIfURIMatchesRegExp = new RegExp(onlyIfURIMatchesRegEx);
  }
  if (changedItems.has("showFileChooserDialog"))
    showFileChooserDialog = changes.showFileChooserDialog.newValue;
  if (changedItems.has("resultNameSuffix"))
    resultNameSuffix = changes.resultNameSuffix.newValue || "";
  if (changedItems.has("ifConflictThen")) {
    ifConflictThen = validIfConflictThen(changes.ifConflictThen.newValue);
    if (changedItems.has("respectHTMLIsNotXML"))
      respectHTMLIsNotXML = changes.respectHTMLIsNotXML.newValue;
  }
}
chrome.storage.onChanged.addListener(onStorageChange);

function initializePageAction(tab) {
  if (onlyIfURIMatchesRegExp.test(tab.url)) {
    chrome.action.enable(tab.id);
  } else {
    chrome.action.disable(tab.id);
  }
}

// each time a tab is updated, e.g. when navigating to a different URL
chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    initializePageAction(tab);
  }
});

// each time a tab is activated, e.g. when switching between tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  initializePageAction(tab);
});

function twoDigitString(number) {
  var string = number.toString();
  return string.length > 1 ? string : "0" + string;
}

function utc() {
  var now = new Date();
  return now.getUTCFullYear().toString() + twoDigitString(now.getUTCMonth() + 1) + twoDigitString(now.getUTCDate()) +
         twoDigitString(now.getUTCHours()) + twoDigitString(now.getUTCMinutes()) + twoDigitString(now.getUTCSeconds());
}

function doIt(tab) {
  var url = tab.url;
  //
  if (!onlyIfURIMatchesRegExp.test(url)) {
    console.log("not saving because URI " + url + " not matching " + onlyIfURIMatchesRegEx);
    return;
  }
  //
  var filenameRegExp = /^[^#?]*?([^\/#?]+)\/?(?:[#?].*)?$/;
  var match = filenameRegExp.exec(url);
  if (match !== null) {
    var filename = match[1];
    filename = decodeURIComponent(filename); // e.g. %20 to space
  } else {
    filename = "untitled";
  }
  if (resultNameSuffix) {
    var suffixToUse = resultNameSuffix.replace(/utc\s*\(\s*\)/ig, utc());
    // from example.svg make example-result.svg
    // instead of using http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    // with path = path.replace(/^(.*?)(\.[^.]*|)$/g, "$1-result$2");
    // do this more pedestrian
    var pathSplitExtensionMatch = /^(.*?)(\.[^.]*|)$/.exec(filename); // made to always match
    filename = pathSplitExtensionMatch[1] + suffixToUse + pathSplitExtensionMatch[2];
  }
  //console.log("try downloading DOM as " + filename);
  //
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content-script.js"]
  }).then((results) => {
    // const result = results[0]?.result;
    // if (result && result.length) {
    if (results && results.length) {
      //console.log("ran chrome.scripting.executeScript");
      chrome.tabs.sendMessage(
        tab.id,
        { please: "nrvrDomSerialize", respectHTMLIsNotXML: respectHTMLIsNotXML },
        response => {
          var documentAsObjectURL = response?.documentAsObjectURL;
          if (documentAsObjectURL) {
            //console.log("got response", response);
            var options = {
              url: documentAsObjectURL,
              filename: filename,
              conflictAction: ifConflictThen, // uniquify, overwrite, prompt
              saveAs: showFileChooserDialog,
            };
            chrome.downloads.download(options,
              id => {
                chrome.downloads.search({id:id},
                  downloadItems => {
                    var filename = downloadItems[0].filename;
                    // Chrome 64 can get here with empty filename while still showing the file chooser,
                    // but has been observed to intermittently get here with the final filename
                    // if option set to not show the file chooser;
                    // hence log if known, else don't
                    console.log("started downloading DOM" + (filename ? " as " + filename : ""));
                  }
                );
              }
            );
          } else {
            onRuntimeLastError();
          }
        }
      );
    } else {
      onExtensionLastError();
    }
  });
}
chrome.action.onClicked.addListener((tab) => {
  doIt(tab);
});
