// Background service worker - handles translation API requests (bypasses CSP!)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Google Translate API
    if (request.type === 'TRANSLATE_BATCH') {
        const promises = request.texts.map(text => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${request.sourceLang || 'auto'}&tl=${request.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            return fetch(url)
                .then(response => response.json())
                .then(data => {
                    const translation = data[0].map(item => item[0]).join('');
                    return { success: true, translation: translation };
                })
                .catch(error => {
                    console.error('Google Translate API error:', error);
                    return { success: false, error: error.message, original: text };
                });
        });

        Promise.all(promises)
            .then(results => {
                sendResponse({ success: true, translations: results });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

    // Microsoft Edge Translator (free, unlimited)
    if (request.type === 'TRANSLATE_BATCH_EDGE') {
        const { texts, sourceLang, targetLang } = request;

        console.log('[Edge Translator] Translating', texts.length, 'texts from', sourceLang, 'to', targetLang);

        // First, get auth token from Edge
        fetch('https://edge.microsoft.com/translate/auth', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        .then(response => response.text())
        .then(authToken => {
            console.log('[Edge Translator] Got auth token');

            // Build translate URL - omit 'from' parameter for auto-detection
            const to = targetLang;
            const translateUrl = sourceLang === 'auto'
                ? `https://api.cognitive.microsofttranslator.com/translate?to=${to}&api-version=3.0&includeSentenceLength=true`
                : `https://api.cognitive.microsofttranslator.com/translate?from=${sourceLang}&to=${to}&api-version=3.0&includeSentenceLength=true`;

            console.log('[Edge Translator] Translate URL:', translateUrl);

            // Prepare request body (Microsoft expects array of objects with "Text" field)
            const requestBody = texts.map(text => ({ Text: text }));
            console.log('[Edge Translator] Request body sample:', requestBody.slice(0, 3));

            // Make translation request
            return fetch(translateUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        })
        .then(response => {
            console.log('[Edge Translator] Response status:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('[Edge Translator] Error response:', text);
                    throw new Error(`HTTP ${response.status}: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('[Edge Translator] Translation successful, received', data.length, 'results');
            console.log('[Edge Translator] Sample result:', data[0]);

            // Microsoft returns array of translation objects
            const results = data.map(item => ({
                success: true,
                translation: item.translations[0].text
            }));

            sendResponse({ success: true, translations: results });
        })
        .catch(error => {
            console.error('[Edge Translator] Error:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true;
    }
});

chrome.commands.onCommand.addListener((command) => {
    console.log('[Hotkey] Command received:', command);

    let messageType = null;

    if (command === 'translate-now') {
        messageType = 'HOTKEY_TRANSLATE';
    } else if (command === 'restore-original') {
        messageType = 'HOTKEY_RESTORE';
    } else if (command === 'set-cn-to-en') {
        messageType = 'HOTKEY_CN_TO_EN';
    } else if (command === 'set-en-to-cn') {
        messageType = 'HOTKEY_EN_TO_CN';
    }

    if (!messageType) {
        console.warn('[Hotkey] Unknown command:', command);
        return;
    }

    console.log('[Hotkey] Sending message type:', messageType);

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const [tab] = tabs;
        if (!tab || tab.id === undefined) {
            console.warn('[Hotkey] No active tab found');
            return;
        }

        console.log('[Hotkey] Sending to tab:', tab.id);

        chrome.tabs.sendMessage(tab.id, { type: messageType }, () => {
            if (chrome.runtime.lastError) {
                console.warn('[Hotkey] Message failed:', chrome.runtime.lastError.message);
            } else {
                console.log('[Hotkey] Message sent successfully');
            }
        });
    });
});
