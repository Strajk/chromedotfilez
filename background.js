'use strict';

function getLocation(href) {
  var match = href.match(/^(https?:)\/\/(([^:/?#]*)(?::([0-9]+))?)(\/[^?#]*)(\?[^#]*|)(#.*|)$/);
  return match && {
    protocol: match[1],
    host: match[2],
    hostname: match[3],
    port: match[4],
    pathname: match[5],
    search: match[6],
    hash: match[7]
  };
}

function popSubdomain(str) {
  var newName = str.replace(/[^.]*\./, '');
  return str !== newName && newName;
}

function insertCSS(tabId, hostname) {
  if (!hostname) {
    return;
  }

  chrome.tabs.insertCSS(tabId, {
    file: 'chromedotfiles/' + hostname + '.css',
    runAt: 'document_start',
    allFrames: true
  }, function (res) {
    if (chrome.runtime.lastError) {
      // fail silently
      return;
    }
  });
  // attempt to insert next stylesheet in a subdomain chain
  insertCSS(tabId, popSubdomain(hostname));
}

function executeScript(tabId, hostname) {
  if (!hostname) {
    return;
  }
  chrome.tabs.executeScript(tabId, {
    file: 'chromedotfiles/' + hostname + '.js'
  }, function(res) {
    if (chrome.runtime.lastError) {
      // fail silently
      return;
    }
  });
  // attempt to execute next script in a subdomain chain
  executeScript(tabId, popSubdomain(hostname));
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  var match = getLocation(tab.url);

  // load css early for no visible delays
  if (changeInfo.status === 'loading') {
    // attempt to insert default css
    insertCSS(tabId, '__default');
    if (match) {
      // attempt to insert domain specific css
      insertCSS(tabId, match.hostname);
    }
  }

  // load js
  if (changeInfo.status === 'complete') {
    // attempt to execute default js
    executeScript(tabId, '__default');
    if (match) {
      // attempt to insert domain specific css
      executeScript(tabId, match.hostname);
    }
  }

});

// This is pretty crazy
// https://stackoverflow.com/a/28858129/1732483
// Just adding `chromedotfiles/__background.js` to the manifest would cause error
// if the file would not exist, so have to use this madness
chrome.runtime.getPackageDirectoryEntry(storageRootEntry => {
  storageRootEntry.getFile(`chromedotfiles/__background.js`, {create: false},
    fileEntry => {
      fileEntry.file(file => {
        var reader = new FileReader();
        reader.onloadend = function (e) {
          // Requires `content_security_policy` set to #YOLO mode in manifest
          eval(e.target.result)
        };
        reader.readAsText(file);
      })
    },
    function () {
      // `__background.js` does not exist
    }
  )
})
