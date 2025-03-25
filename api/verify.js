const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase配置信息（从环境变量获取）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// 简单的密码哈希函数
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 生成安全的会话令牌
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 验证会话令牌
function verifySessionToken(token) {
  return token && token.length === 64; // 简单的长度检查
}

// 获取客户端设备信息
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '未知设备';
  return userAgent;
}

// 获取IP地址
function getIpAddress(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         '未知IP';
}

module.exports = async (req, res) => {
  // 处理 GET 请求（检查登录状态）
  if (req.method === 'GET') {
    try {
      const sessionToken = req.cookies?.authenticated;
      if (!sessionToken || !verifySessionToken(sessionToken)) {
        return res.status(401).json({ error: '未授权访问' });
      }
      
      // 在数据库中验证会话有效性
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .single();
      
      if (error || !data) {
        // 会话无效
        return res.status(401).json({ error: '会话已失效，请重新登录' });
      }
      
      // 更新最后活动时间
      await supabase
        .from('active_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('session_token', sessionToken);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Auth Check Error:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return res.status(500).json({ error: '验证失败' });
    }
  }

  // 处理 POST 请求（登录）
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;
    
    // 输入验证
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '请输入有效的密码' });
    }

    // 获取密码列表并哈希处理
    const passwords = process.env.ACCESS_PASSWORDS?.split(',').map(p => p.trim()) || [];
    const hashedPasswords = passwords.map(p => hashPassword(p));
    const hashedInput = hashPassword(password);

    if (passwords.length === 0) {
      console.error('ACCESS_PASSWORDS environment variable is not set');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 检查输入的密码是否在允许的密码列表中
    if (hashedPasswords.includes(hashedInput)) {
      // 生成新会话令牌
      const sessionToken = generateSessionToken();
      
      // 获取设备信息和IP地址
      const deviceInfo = getDeviceInfo(req);
      const ipAddress = getIpAddress(req);
      
      // 检查是否已有活跃会话
      const { data: existingSession } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('password_hash', hashedInput)
        .single();
      
      if (existingSession) {
        // 存在活跃会话，删除旧会话
        await supabase
          .from('active_sessions')
          .delete()
          .eq('password_hash', hashedInput);
          
        console.info(`Replacing existing session for password hash ${hashedInput.substring(0, 8)}...`);
      }
      
      // 创建新会话记录
      const { error: insertError } = await supabase
        .from('active_sessions')
        .insert([
          { 
            password_hash: hashedInput,
            session_token: sessionToken,
            device_info: deviceInfo,
            ip_address: ipAddress,
            last_activity: new Date().toISOString()
          }
        ]);
      
      if (insertError) {
        console.error('Session creation error:', insertError);
        return res.status(500).json({ error: '创建会话失败' });
      }
      
      const cookieOptions = [
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        'Max-Age=86400', // 24小时过期
        'Secure' // 仅在HTTPS下传输
      ];

      // 设置安全的 cookie
      res.setHeader('Set-Cookie', [
        `authenticated=${sessionToken}; ${cookieOptions.join('; ')}`,
        `lastLogin=${Date.now()}; ${cookieOptions.join('; ')}`
      ]);

      // 记录成功的登录
      console.info(`Successful login at ${new Date().toISOString()}`);
      return res.status(200).json({ success: true });
    }

    // 记录失败的登录尝试（只记录时间，不记录密码）
    console.warn(`Failed login attempt at ${new Date().toISOString()}`);
    return res.status(401).json({ error: '密码错误' });
  } catch (error) {
    // 记录详细错误信息，但不返回给客户端
    console.error('Verification Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ error: '验证失败，请稍后重试' });
  }
} 
