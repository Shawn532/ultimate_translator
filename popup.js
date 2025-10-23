// Popup script for Ultimate Translator extension menu

document.getElementById('web-translate-btn').addEventListener('click', () => {
    // Close popup and let user interact with the existing floating ball on the page
    window.close();
});

document.getElementById('excel-translate-btn').addEventListener('click', () => {
    // Open Excel translator in new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('excel-translator.html')
    });
    window.close();
});
