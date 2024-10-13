// src/contentScript.js

import { v4 as uuidv4 } from "uuid";
import { createPatch } from "diff";
import serializeHTML from "./serializeHTML";
import { diff_match_patch } from "diff-match-patch";

// Variables to manage state
let previousSerializedDOM = null;
let checkpointId = null;
let parentId = null;
let diffTimeout = null;
let currentURL = location.href;
let currentIndex = 0;
let initialCheckpointId = null;
const MIN_BATCH_SIZE = 200 * 1024; // 200 kB in bytes
let batchQueue = [];

function getCurrentDOM() {
  return serializeHTML(document.documentElement.outerHTML);
}

function createCheckpoint(domContent) {
  // const domContent = getCurrentDOM();

  checkpointId = uuidv4();
  initialCheckpointId = checkpointId;
  parentId = null;
  // previousSerializedDOM = domContent;
  currentIndex = 0;
  return {
    type: "checkpoint",
    id: checkpointId,
    parent_id: parentId,
    initial_checkpoint_id: initialCheckpointId,
    content: domContent,
    index: currentIndex,
  };
}

// Initial setup
function initialize() {
  // const domContent = getCurrentDOM();
  // addToBatch(domContent);

  sendBatchAndReset();

  // Set up MutationObserver
  const observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
}

// function getSerializedMutationSize(mutation) {
//   const serializedMutation = JSON.stringify(serializeMutation(mutation));
//   return new TextEncoder().encode(serializedMutation).length;
// }

// function getSerializedMutationSize(serializedMutation) {
//   const jsonString = JSON.stringify(serializedMutation);
//   // Measure byte length of the JSON string
//   return new Blob([jsonString]).size;
// }

// function serializeNode(node) {
//   const obj = {
//     nodeType: node.nodeType,
//     nodeName: node.nodeName,
//   };

//   if (node.nodeType === Node.ELEMENT_NODE) {
//     obj.attributes = {};
//     for (let attr of node.attributes) {
//       obj.attributes[attr.name] = attr.value;
//     }
//     obj.childNodes = Array.from(node.childNodes).map(serializeNode);
//   } else if (node.nodeType === Node.TEXT_NODE) {
//     obj.textContent = node.textContent;
//   }

//   return obj;
// }

// function serializeNode(node) {
//   const obj = {
//     nodeType: node.nodeType,
//     nodeName: node.nodeName,
//   };

//   if (node.nodeType === Node.ELEMENT_NODE) {
//     obj.attributes = {};
//     for (let attr of node.attributes) {
//       obj.attributes[attr.name] = attr.value;
//     }
//     // Serialize child nodes if needed
//     obj.childNodes = [];
//     node.childNodes.forEach((child) => {
//       obj.childNodes.push(serializeNode(child));
//     });
//   } else if (node.nodeType === Node.TEXT_NODE) {
//     obj.textContent = node.textContent;
//   }

//   return obj;
// }

// function getUniqueSelector(element) {
//   if (element.id) {
//     return `#${element.id}`;
//   }
//   const path = [];
//   while (element && element.nodeType === Node.ELEMENT_NODE) {
//     let selector = element.nodeName.toLowerCase();
//     if (element.className) {
//       selector += `.${element.className.trim().replace(/\s+/g, '.')}`;
//     }
//     path.unshift(selector);
//     element = element.parentElement;
//   }
//   return path.join(' > ');
// }

// function getUniqueSelector(element) {
//   if (element.id) {
//     return `#${element.id}`;
//   }
//   const parts = [];
//   while (element && element.nodeType === Node.ELEMENT_NODE) {
//     let selector = element.nodeName.toLowerCase();
//     if (element.className) {
//       selector += `.${element.className.trim().replace(/\s+/g, ".")}`;
//     }
//     const siblingIndex =
//       Array.from(element.parentNode.children).indexOf(element) + 1;
//     selector += `:nth-child(${siblingIndex})`;
//     parts.unshift(selector);
//     element = element.parentElement;
//   }
//   return parts.join(" > ");
// }

// function serializeMutation(mutation) {
//   const {
//     type,
//     attributeName,
//     oldValue,
//     target,
//     addedNodes,
//     removedNodes,
//     previousSibling,
//     nextSibling,
//   } = mutation;

//   const serialized = {
//     type,
//     attributeName,
//     oldValue,
//     targetSelector: getUniqueSelector(target),
//   };

//   if (type === "childList") {
//     serialized.addedNodes = Array.from(addedNodes).map(serializeNode);
//     serialized.removedNodes = Array.from(removedNodes).map(serializeNode);
//     serialized.previousSiblingSelector = previousSibling
//       ? getUniqueSelector(previousSibling)
//       : null;
//     serialized.nextSiblingSelector = nextSibling
//       ? getUniqueSelector(nextSibling)
//       : null;
//   } else if (type === "characterData") {
//     serialized.newValue = mutation.target.textContent;
//   }

//   return serialized;
// }

// function serializeMutation(mutation) {
//   const serialized = {
//     type: mutation.type,
//     targetSelector: getUniqueSelector(mutation.target),
//   };

//   if (mutation.type === "attributes") {
//     serialized.attributeName = mutation.attributeName;
//     serialized.newValue = mutation.target.getAttribute(mutation.attributeName);
//     serialized.oldValue = mutation.oldValue;
//   } else if (mutation.type === "characterData") {
//     serialized.newValue = mutation.target.data;
//     serialized.oldValue = mutation.oldValue;
//   } else if (mutation.type === "childList") {
//     serialized.addedNodes = Array.from(mutation.addedNodes).map(serializeNode);
//     serialized.removedNodes = Array.from(mutation.removedNodes).map(
//       serializeNode
//     );
//     serialized.previousSiblingSelector = mutation.previousSibling
//       ? getUniqueSelector(mutation.previousSibling)
//       : null;
//     serialized.nextSiblingSelector = mutation.nextSibling
//       ? getUniqueSelector(mutation.nextSibling)
//       : null;
//   }
//   console.log("serialized", serialized);
//   return serialized;
// }

// function getTextChangeSize(mutation) {
//   if (mutation.type === "characterData") {
//     return mutation.target.textContent.length;
//   }
//   return 0;
// }

function extractHTMLFromChildListMutation(mutation) {
  const addedHTML = Array.from(mutation.addedNodes).map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return node.outerHTML;
    } else if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    return '';
  }).join('');

  const removedHTML = Array.from(mutation.removedNodes).map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return node.outerHTML;
    } else if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    return '';
  }).join('');

  return { addedHTML, removedHTML };
}

function extractHTMLFromAttributesMutation(mutation) {
  const target = mutation.target;
  if (target.nodeType === Node.ELEMENT_NODE) {
    return target.outerHTML;
  }
  return '';
}


function extractHTMLFromCharacterDataMutation(mutation) {
  const target = mutation.target;
  if (target.nodeType === Node.TEXT_NODE) {
    return target.textContent;
  }
  return '';
}

function getMutationSize(mutation) {
  let htmlContent = '';

  switch (mutation.type) {
    case 'childList':
      const { addedHTML, removedHTML } = extractHTMLFromChildListMutation(mutation);
      htmlContent = addedHTML + removedHTML;
      break;
    case 'attributes':
      htmlContent = extractHTMLFromAttributesMutation(mutation);
      break;
    case 'characterData':
      htmlContent = extractHTMLFromCharacterDataMutation(mutation);
      break;
    default:
      break;
  }

  // Encode the HTML content to accurately measure byte size
  const encoder = new TextEncoder();
  const encoded = encoder.encode(htmlContent);
  return encoded.length; // Size in bytes
}


// Handle DOM mutations
function handleMutations(mutationsList, observer) {
  console.log("============================================");
  // Add current changes to the batch

  // const textChangeSize = mutationsList.reduce(
  //   (total, mutation) => total + getTextChangeSize(mutation),
  //   0
  // );
  // console.log("textChangeSize", textChangeSize);
  // const serializedMutationSize = mutationsList.reduce(
  //   (total, mutation) => total + getMutationSize(mutation),
  //   0
  // );

  // // Print stringified mutations
  // console.log("ASDFG", JSON.stringify(mutationsList));
  // console.log("serializedMutationSize", serializedMutationSize);
  // console.log(mutationsList);

  // if (serializedMutationSize < 100000) {
  //   return;
  // }

  const currentDOM = getCurrentDOM();

  let first_checkpoint = previousSerializedDOM === null;
  addToBatch(currentDOM);

  if (first_checkpoint) {
    sendBatchAndReset();
    return;
  }

  // If there's no active timeout, start a new 5-second counter
  if (!diffTimeout) {
    diffTimeout = setTimeout(() => {
      sendBatchIfLargeEnough();
    }, 5000);
  }
}

function addToBatch(currentDOM) {
  let previousIsNull = previousSerializedDOM === null;
  if (!previousSerializedDOM) {
    previousSerializedDOM = "";
  }

  const diff = computeDiff(previousSerializedDOM, currentDOM);
  console.log("diff", diff);
  const diffSize = JSON.stringify(diff).length;
  const checkpointSize = currentDOM.length;
  let new_obj = {};
  currentIndex++;

  if (
    diffSize < checkpointSize &&
    !previousIsNull &&
    checkpointId !== null &&
    initialCheckpointId !== null
  ) {
    const newDiffId = uuidv4();

    new_obj = {
      type: "diff",
      id: newDiffId,
      parent_id: checkpointId,
      initial_checkpoint_id: initialCheckpointId,
      diff: diff,
      index: currentIndex,
    };
    checkpointId = newDiffId; // Update checkpointId to the new diff's ID
  } else {
    new_obj = createCheckpoint(currentDOM);
  }

  batchQueue.push(new_obj);

  previousSerializedDOM = currentDOM;
}

function sendBatchIfLargeEnough() {
  const batchSize = new Blob([JSON.stringify(batchQueue)]).size;
  console.log("batchSize", batchSize);

  // if (batchSize >= MIN_BATCH_SIZE || (diffTimeout && batchQueue.length > 0)) {
  if (batchSize >= MIN_BATCH_SIZE) {
    sendBatchAndReset();
  } else {
    diffTimeout = setTimeout(() => {
      sendBatchIfLargeEnough();
    }, 5000);
  }
}

function sendBatchAndReset() {
  if (batchQueue.length > 0) {
    // Send the batch to the background script
    chrome.runtime.sendMessage(
      {
        type: "batch",
        data: batchQueue,
      },
      function (response) {
        console.log("Batch sent:", response);
      }
    );

    batchQueue = [];
    diffTimeout = null;
  }
}

// Compute text diffs using the diff-match-patch library
function computeDiff(oldStr, newStr) {
  const dmp = new diff_match_patch();
  const diff = dmp.diff_main(oldStr, newStr);
  // dmp.diff_cleanupSemantic(diff);
  return dmp.patch_toText(dmp.patch_make(oldStr, diff));
}

// Detect URL changes to create new checkpoints
function checkURLChange() {
  if (currentURL !== location.href) {
    currentURL = location.href;
    currentIndex = 0; // Reset index for new page
    initialCheckpointId = null; // Reset initial checkpoint ID for new page
    initialize(); // Re-initialize for the new page
  }
}

// Initialize the content script
initialize();

// Set up a periodic check for URL changes
setInterval(checkURLChange, 1000); // Check every second
