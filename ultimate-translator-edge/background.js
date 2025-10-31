// Background service worker - handles translation API requests (bypasses CSP!)

// MD5 hash function for Baidu API signature
function md5(string) {
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }

    function addUnsigned(x, y) {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    function md5cmn(q, a, b, x, s, t) {
        return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
    }

    function md5ff(a, b, c, d, x, s, t) {
        return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function md5gg(a, b, c, d, x, s, t) {
        return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function md5hh(a, b, c, d, x, s, t) {
        return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function md5ii(a, b, c, d, x, s, t) {
        return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function convertToWordArray(string) {
        const wordArray = [];
        for (let i = 0; i < string.length * 8; i += 8) {
            wordArray[i >> 5] |= (string.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return wordArray;
    }

    function wordToHex(value) {
        let hex = '';
        for (let i = 0; i < 4; i++) {
            hex += ('0' + ((value >> (i * 8)) & 0xFF).toString(16)).slice(-2);
        }
        return hex;
    }

    const x = convertToWordArray(string);
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;

    x[string.length * 8 >> 5] |= 0x80 << ((string.length * 8) % 32);
    x[(((string.length * 8 + 64) >>> 9) << 4) + 14] = string.length * 8;

    for (let i = 0; i < x.length; i += 16) {
        const oldA = a, oldB = b, oldC = c, oldD = d;

        a = md5ff(a, b, c, d, x[i + 0], 7, 0xD76AA478);
        d = md5ff(d, a, b, c, x[i + 1], 12, 0xE8C7B756);
        c = md5ff(c, d, a, b, x[i + 2], 17, 0x242070DB);
        b = md5ff(b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
        a = md5ff(a, b, c, d, x[i + 4], 7, 0xF57C0FAF);
        d = md5ff(d, a, b, c, x[i + 5], 12, 0x4787C62A);
        c = md5ff(c, d, a, b, x[i + 6], 17, 0xA8304613);
        b = md5ff(b, c, d, a, x[i + 7], 22, 0xFD469501);
        a = md5ff(a, b, c, d, x[i + 8], 7, 0x698098D8);
        d = md5ff(d, a, b, c, x[i + 9], 12, 0x8B44F7AF);
        c = md5ff(c, d, a, b, x[i + 10], 17, 0xFFFF5BB1);
        b = md5ff(b, c, d, a, x[i + 11], 22, 0x895CD7BE);
        a = md5ff(a, b, c, d, x[i + 12], 7, 0x6B901122);
        d = md5ff(d, a, b, c, x[i + 13], 12, 0xFD987193);
        c = md5ff(c, d, a, b, x[i + 14], 17, 0xA679438E);
        b = md5ff(b, c, d, a, x[i + 15], 22, 0x49B40821);
        a = md5gg(a, b, c, d, x[i + 1], 5, 0xF61E2562);
        d = md5gg(d, a, b, c, x[i + 6], 9, 0xC040B340);
        c = md5gg(c, d, a, b, x[i + 11], 14, 0x265E5A51);
        b = md5gg(b, c, d, a, x[i + 0], 20, 0xE9B6C7AA);
        a = md5gg(a, b, c, d, x[i + 5], 5, 0xD62F105D);
        d = md5gg(d, a, b, c, x[i + 10], 9, 0x02441453);
        c = md5gg(c, d, a, b, x[i + 15], 14, 0xD8A1E681);
        b = md5gg(b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
        a = md5gg(a, b, c, d, x[i + 9], 5, 0x21E1CDE6);
        d = md5gg(d, a, b, c, x[i + 14], 9, 0xC33707D6);
        c = md5gg(c, d, a, b, x[i + 3], 14, 0xF4D50D87);
        b = md5gg(b, c, d, a, x[i + 8], 20, 0x455A14ED);
        a = md5gg(a, b, c, d, x[i + 13], 5, 0xA9E3E905);
        d = md5gg(d, a, b, c, x[i + 2], 9, 0xFCEFA3F8);
        c = md5gg(c, d, a, b, x[i + 7], 14, 0x676F02D9);
        b = md5gg(b, c, d, a, x[i + 12], 20, 0x8D2A4C8A);
        a = md5hh(a, b, c, d, x[i + 5], 4, 0xFFFA3942);
        d = md5hh(d, a, b, c, x[i + 8], 11, 0x8771F681);
        c = md5hh(c, d, a, b, x[i + 11], 16, 0x6D9D6122);
        b = md5hh(b, c, d, a, x[i + 14], 23, 0xFDE5380C);
        a = md5hh(a, b, c, d, x[i + 1], 4, 0xA4BEEA44);
        d = md5hh(d, a, b, c, x[i + 4], 11, 0x4BDECFA9);
        c = md5hh(c, d, a, b, x[i + 7], 16, 0xF6BB4B60);
        b = md5hh(b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
        a = md5hh(a, b, c, d, x[i + 13], 4, 0x289B7EC6);
        d = md5hh(d, a, b, c, x[i + 0], 11, 0xEAA127FA);
        c = md5hh(c, d, a, b, x[i + 3], 16, 0xD4EF3085);
        b = md5hh(b, c, d, a, x[i + 6], 23, 0x04881D05);
        a = md5hh(a, b, c, d, x[i + 9], 4, 0xD9D4D039);
        d = md5hh(d, a, b, c, x[i + 12], 11, 0xE6DB99E5);
        c = md5hh(c, d, a, b, x[i + 15], 16, 0x1FA27CF8);
        b = md5hh(b, c, d, a, x[i + 2], 23, 0xC4AC5665);
        a = md5ii(a, b, c, d, x[i + 0], 6, 0xF4292244);
        d = md5ii(d, a, b, c, x[i + 7], 10, 0x432AFF97);
        c = md5ii(c, d, a, b, x[i + 14], 15, 0xAB9423A7);
        b = md5ii(b, c, d, a, x[i + 5], 21, 0xFC93A039);
        a = md5ii(a, b, c, d, x[i + 12], 6, 0x655B59C3);
        d = md5ii(d, a, b, c, x[i + 3], 10, 0x8F0CCC92);
        c = md5ii(c, d, a, b, x[i + 10], 15, 0xFFEFF47D);
        b = md5ii(b, c, d, a, x[i + 1], 21, 0x85845DD1);
        a = md5ii(a, b, c, d, x[i + 8], 6, 0x6FA87E4F);
        d = md5ii(d, a, b, c, x[i + 15], 10, 0xFE2CE6E0);
        c = md5ii(c, d, a, b, x[i + 6], 15, 0xA3014314);
        b = md5ii(b, c, d, a, x[i + 13], 21, 0x4E0811A1);
        a = md5ii(a, b, c, d, x[i + 4], 6, 0xF7537E82);
        d = md5ii(d, a, b, c, x[i + 11], 10, 0xBD3AF235);
        c = md5ii(c, d, a, b, x[i + 2], 15, 0x2AD7D2BB);
        b = md5ii(b, c, d, a, x[i + 9], 21, 0xEB86D391);

        a = addUnsigned(a, oldA);
        b = addUnsigned(b, oldB);
        c = addUnsigned(c, oldC);
        d = addUnsigned(d, oldD);
    }

    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TRANSLATE_BATCH') {
        // Google Translate API - multiple texts at once
        const promises = request.texts.map(text => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${request.sourceLang || 'auto'}&tl=${request.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            return fetch(url)
                .then(response => response.json())
                .then(data => {
                    const translation = data[0].map(item => item[0]).join('');
                    return { success: true, translation: translation };
                })
                .catch(error => {
                    console.error('Google Translation API error:', error);
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

    if (request.type === 'TRANSLATE_BATCH_BAIDU') {
        // Baidu Translate API - multiple texts at once
        const { texts, sourceLang, targetLang, appId, appKey } = request;

        // Helper function to add delay
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Baidu free tier: 10 QPS (queries per second)
        // Process in batches of 10 with 1 second delay between batches
        const batchSize = 10;
        const batchDelay = 1000; // 1 second

        const translateBatch = async (batchTexts, startIndex) => {
            return Promise.all(batchTexts.map((text, index) => {
                // Generate unique salt (timestamp + random + index to ensure uniqueness)
                const salt = Date.now().toString() + Math.random().toString(36).substring(2, 7) + (startIndex + index);

                // Generate signature: MD5(appid+q+salt+key)
                const signStr = appId + text + salt + appKey;
                const sign = md5(signStr);

                console.log(`[DEBUG] Baidu signature for text "${text.substring(0, 20)}...": appId=${appId}, salt=${salt}, sign=${sign}`);

                // Build URL
                const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=${sourceLang || 'auto'}&to=${targetLang}&appid=${appId}&salt=${salt}&sign=${sign}`;

                return fetch(url)
                .then(response => response.json())
                .then(data => {
                    console.log('[DEBUG] Baidu API raw response:', data);

                    if (data.error_code) {
                        console.error('Baidu API error:', data.error_code, data.error_msg);
                        return { success: false, error: `${data.error_code}: ${data.error_msg}`, original: text };
                    }

                    // Baidu returns array of translations
                    if (!data.trans_result || !Array.isArray(data.trans_result)) {
                        console.error('Baidu API returned invalid format:', data);
                        return { success: false, error: 'Invalid response format', original: text };
                    }

                    const translation = data.trans_result.map(item => item.dst).join('');

                    if (!translation) {
                        console.error('Baidu API returned empty translation');
                        return { success: false, error: 'Empty translation', original: text };
                    }

                    return { success: true, translation: translation };
                })
                .catch(error => {
                    console.error('Baidu Translation API error:', error);
                    return { success: false, error: error.message, original: text };
                });
            }));
        };

        // Process all texts in batches to respect QPS limit
        (async () => {
            const allResults = [];

            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                console.log(`[DEBUG] Processing Baidu batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`);

                const batchResults = await translateBatch(batch, i);
                allResults.push(...batchResults);

                // Wait before next batch (except for last batch)
                if (i + batchSize < texts.length) {
                    console.log(`[DEBUG] Waiting ${batchDelay}ms before next batch...`);
                    await delay(batchDelay);
                }
            }

            sendResponse({ success: true, translations: allResults });
        })();

        return true;
    }

    if (request.type === 'TRANSLATE_BATCH_LIBRETRANSLATE') {
        // LibreTranslate API - free and open source
        const { texts, sourceLang, targetLang } = request;

        // Multiple public LibreTranslate instances (fallback if one is down/rate-limited)
        const instances = [
            'https://translate.argosopentech.com/translate',
            'https://libretranslate.de/translate',
            'https://libretranslate.com/translate'
        ];

        // Randomly pick an instance to distribute load
        const url = instances[Math.floor(Math.random() * instances.length)];
        console.log(`[DEBUG] Using LibreTranslate instance: ${url}`);

        // Batch processing to avoid rate limits (5 requests per batch, 500ms delay)
        const batchSize = 5;
        const batchDelay = 500; // 0.5 seconds
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const translateBatch = async (batchTexts, startIndex) => {
            return Promise.all(batchTexts.map((text, index) => {
                return fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    q: text,
                    source: sourceLang || 'auto',
                    target: targetLang,
                    format: 'text'
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log('[DEBUG] LibreTranslate API raw response:', data);

                if (data.error) {
                    console.error('LibreTranslate API error:', data.error);
                    return { success: false, error: data.error, original: text };
                }

                if (!data.translatedText) {
                    console.error('LibreTranslate API returned invalid format:', data);
                    return { success: false, error: 'Invalid response format', original: text };
                }

                return { success: true, translation: data.translatedText };
            })
            .catch(error => {
                console.error('LibreTranslate API error:', error);
                return { success: false, error: error.message, original: text };
            });
            }));
        };

        // Process in batches to respect rate limits
        (async () => {
            const allResults = [];

            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                console.log(`[DEBUG] Processing LibreTranslate batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`);

                const batchResults = await translateBatch(batch, i);
                allResults.push(...batchResults);

                // Wait before next batch (except for last batch)
                if (i + batchSize < texts.length) {
                    console.log(`[DEBUG] Waiting ${batchDelay}ms before next batch...`);
                    await delay(batchDelay);
                }
            }

            sendResponse({ success: true, translations: allResults });
        })();

        return true;
    }

    if (request.type === 'TRANSLATE_BATCH_ZVO') {
        // ZVO Translate API - free Chinese translation service
        const { texts, sourceLang, targetLang } = request;

        // ZVO API endpoints (multiple servers for reliability)
        const servers = [
            'https://api.translate.zvo.cn/',
            'https://america.api.translate.zvo.cn/'
        ];

        // Randomly pick a server
        const baseUrl = servers[Math.floor(Math.random() * servers.length)];
        const url = baseUrl + 'translate.json';
        console.log(`[DEBUG] Using ZVO Translate server: ${baseUrl}`);

        // ZVO rate limit: 2 requests per 2 seconds
        // So we do 2 per batch with 2 second delay
        const batchSize = 2;
        const batchDelay = 2000; // 2 seconds
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const translateBatch = async (batchTexts, startIndex) => {
            return Promise.all(batchTexts.map((text, index) => {
                // ZVO API requires specific format
                const formData = new URLSearchParams();
                formData.append('text', text);
                formData.append('from', sourceLang || 'auto');
                formData.append('to', targetLang);

                return fetch(url, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    console.log('[DEBUG] ZVO API raw response:', data);

                    // ZVO returns result:1 for success, not success:true
                    if (data.result !== 1) {
                        console.error('ZVO API error:', data.info || 'Unknown error');
                        return { success: false, error: data.info || 'Translation failed', original: text };
                    }

                    // ZVO returns text as an array
                    if (!data.text || !Array.isArray(data.text) || data.text.length === 0) {
                        console.error('ZVO API returned invalid format:', data);
                        return { success: false, error: 'Invalid response format', original: text };
                    }

                    // Join array elements (though usually just one element)
                    return { success: true, translation: data.text.join('') };
                })
                .catch(error => {
                    console.error('ZVO Translate API error:', error);
                    return { success: false, error: error.message, original: text };
                });
            }));
        };

        // Process all texts in batches to respect rate limits
        (async () => {
            const allResults = [];
            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                console.log(`[DEBUG] Processing ZVO batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

                const batchResults = await translateBatch(batch, i);
                allResults.push(...batchResults);

                // Add delay between batches (except after the last batch)
                if (i + batchSize < texts.length) {
                    console.log(`[DEBUG] Waiting ${batchDelay}ms before next ZVO batch...`);
                    await delay(batchDelay);
                }
            }
            sendResponse({ success: true, translations: allResults });
        })();

        return true;
    }

    // Microsoft Edge Translator (from client.edge in translate.js)
    // Uses Microsoft's free translation API via Edge browser auth
    if (request.type === 'TRANSLATE_BATCH_EDGE') {
        const { texts, sourceLang, targetLang } = request;

        console.log('[DEBUG] Using Microsoft Edge Translator (free, unlimited)');

        // First, get auth token from Edge
        fetch('https://edge.microsoft.com/translate/auth', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        .then(response => response.text())
        .then(authToken => {
            console.log('[DEBUG] Got Edge auth token');

            // Map language codes to Microsoft's format
            const from = sourceLang === 'auto' ? sourceLang : sourceLang;
            const to = targetLang;

            // Build translate URL
            const translateUrl = `https://api.cognitive.microsofttranslator.com/translate?from=${from}&to=${to}&api-version=3.0&includeSentenceLength=true`;

            // Prepare request body (Microsoft expects array of objects with "Text" field)
            const requestBody = texts.map(text => ({ Text: text }));

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
        .then(response => response.json())
        .then(data => {
            console.log('[DEBUG] Microsoft Edge translation response:', data);

            // Microsoft returns array of translation objects
            const results = data.map(item => ({
                success: true,
                translation: item.translations[0].text
            }));

            sendResponse({ success: true, translations: results });
        })
        .catch(error => {
            console.error('[ERROR] Microsoft Edge Translator error:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true;
    }
});
