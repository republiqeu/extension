// src/background.js

// Note: Background scripts in Manifest V3 can be ES modules.

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "checkpoint" || request.type === "batch") {
    chrome.storage.local.get(["authToken"], function (result) {
      const headers = {
        "Content-Type": "application/json",
      };
      if (result.authToken) {
        headers["Authorization"] = `Bearer ${result.authToken}`;
      }

      // fetch('http://localhost:8000/v1/doms', {
      fetch("https://api.republiq.eu/v1/doms/", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(request),
      })
        .then((response) => response.text())
        .then((data) => {
          console.log("Success:", data);
          sendResponse({ status: "success" });
        })
        .catch((error) => {
          console.error("Error:", error);
          sendResponse({ status: "error", error: error });
        });
    });

    // Indicate that we will respond asynchronously
    return true;
  }
});
