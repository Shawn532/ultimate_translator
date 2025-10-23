// Bridge script running in ISOLATED world to provide chrome API access to MAIN world

// Listen for messages from MAIN world
window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    if (event.data.type === 'FETCH_TRANSLATION_REQUEST') {
        // Forward to background script
        chrome.runtime.sendMessage({
            type: 'FETCH_TRANSLATION',
            url: event.data.url,
            method: event.data.method,
            headers: event.data.headers,
            body: event.data.body
        }, (response) => {
            // Send response back to MAIN world
            window.postMessage({
                type: 'FETCH_TRANSLATION_RESPONSE',
                requestId: event.data.requestId,
                response: response
            }, '*');
        });
    }
});

// Notify MAIN world that bridge is ready
window.postMessage({ type: 'BRIDGE_READY' }, '*');
