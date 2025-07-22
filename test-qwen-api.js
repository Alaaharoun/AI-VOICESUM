// Test script for Qwen API
require('dotenv/config');

async function testQwenAPI() {
  console.log('=== QWEN API TEST ===');
  
  const qwenApiKey = process.env.EXPO_PUBLIC_QWEN_API_KEY;
  console.log('Qwen API Key available:', !!qwenApiKey);
  console.log('Qwen API Key length:', qwenApiKey ? qwenApiKey.length : 0);
  console.log('Qwen API Key preview:', qwenApiKey ? qwenApiKey.substring(0, 10) + '...' : 'null');
  
  if (!qwenApiKey || qwenApiKey.trim() === '' || qwenApiKey === 'your_api_key_here') {
    console.log('❌ Qwen API key not available');
    return;
  }
  
  const testText = "Hello, this is a test text for summarization. We want to see if the Qwen API is working correctly. This should generate a summary of the main points.";
  
  try {
    console.log('Testing Qwen API with text:', testText);
    
    const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qwenApiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates clear, concise summaries of spoken text. Your job is to extract and list the main points and ideas only. Do NOT rewrite or paraphrase the text. Do NOT copy the text. Focus on summarizing the topics and key points as a bullet-point list. Summarize only the main points and ideas that are actually present in the text. Do NOT add extra points or details. If the text is short, keep the summary short and do not artificially lengthen it.',
          },
          {
            role: 'user',
            content: `Summarize this text as a bullet-point list:\n\n${testText}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      const summary = data.choices[0].message.content.trim();
      console.log('✅ Summary generated:', summary);
    } else {
      console.error('❌ Invalid response structure:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testQwenAPI(); 