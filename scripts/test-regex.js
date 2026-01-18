
const URL_PATTERNS = [
    /https?:\/\/[\w\-\._~:/?#[\]@!$&'*+,;=%()]+/g,
];

const text = "https://github.com/vladelaina/Catime s";

for (const pattern of URL_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        console.log(`Match: "${match[0]}"`);
        console.log(`Start: ${match.index}`);
        console.log(`End: ${match.index + match[0].length}`);
    }
}
