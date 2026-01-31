#!/usr/bin/env node

const code = `<a href="https://vladelaina.github.io/Catime/support.html"><imgsrc="https://github.com/user-attachments/assets/49035b18-e803-4ee8-9ea5-2e3f32f099de"width="1889"height="872"alt=`;

// Simulate the detection
const htmlTagMatches = code.match(/<(div|span|p|a|img|table|form|input|button|h[1-6]|ul|ol|li)[\s>\/]/gi);
console.log('HTML tag matches:', htmlTagMatches);
console.log('Match count:', htmlTagMatches?.length);

const hasAttributes = /<(a|img|div|span|input|button|link|meta|script)[^>]*(href|src|class|id|style|alt|width|height)=/i.test(code);
console.log('Has attributes:', hasAttributes);

if (htmlTagMatches && htmlTagMatches.length >= 2) {
  console.log('✅ Would detect as HTML (>= 2 tags)');
} else if (hasAttributes) {
  console.log('✅ Would detect as HTML (has attributes)');
} else {
  console.log('❌ Would NOT detect as HTML');
}
