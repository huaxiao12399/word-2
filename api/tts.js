const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase配置信息（从环境变量获取）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// 验证会话令牌
async function verifySessionToken(token) {
  if (!token || token.length !== 64) return false;
  
  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('session_token', token)
      .single();
    
    return !error && !!data;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}

module.exports = async (req, res) => {
  // 检查认证状态
  const sessionToken = req.cookies?.authenticated;
  const isValid = await verifySessionToken(sessionToken);
  
  if (!isValid) {
    return res.status(401).json({ error: '未授权访问' });
  }

  // 更新最后活动时间
  await supabase
    .from('active_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', sessionToken);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const subscription_key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastasia';
    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    if (!subscription_key) {
      throw new Error('Azure Speech API key is not configured');
    }

    // 转义特殊字符
    const escapedText = text.replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

    const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <voice name="en-GB-SoniaNeural">
        <prosody rate="0%" pitch="0%">
            ${escapedText}
        </prosody>
    </voice>
</speak>`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscription_key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (!response.ok) {
      console.error('Azure Speech API Error:', {
        status: response.status,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Azure Speech API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('TTS Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message 
    });
  }
} 