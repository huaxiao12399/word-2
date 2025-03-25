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
    const API_URL = "https://generativelanguage.googleapis.com/v1beta";
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      throw new Error('API key is not configured');
    }

    const payload = req.body;
    if (!payload.contents || !payload.contents[0]?.parts?.[0]?.text) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    const response = await fetch(`${API_URL}/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API Error:', {
        status: response.status,
        data: errorData,
        timestamp: new Date().toISOString()
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      const result = data.candidates[0].content.parts[0].text;
      res.json({ result });
    } else {
      throw new Error('No valid response from API');
    }
  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      error: 'Failed to fetch word information',
      details: error.message 
    });
  }
}