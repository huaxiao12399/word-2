import supabase from './supabaseClient';

export function withAuth(handler) {
  return async (req, res) => {
    // 检查是否是登录页面或验证API
    if (req.url === '/login.html' || req.url === '/api/verify') {
      return handler(req, res);
    }

    // 获取会话令牌
    const sessionToken = req.cookies?.authenticated;
    
    if (!sessionToken) {
      // 如果是 API 请求，返回 401
      if (req.url.startsWith('/api/')) {
        return res.status(401).json({ error: '未授权访问' });
      }
      // 如果是页面请求，重定向到登录页
      return res.redirect('/login.html');
    }
    
    try {
      // 从数据库验证会话有效性
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .single();
      
      if (error || !data) {
        // 会话无效
        if (req.url.startsWith('/api/')) {
          return res.status(401).json({ error: '会话已失效，请重新登录' });
        }
        // 清除cookie
        res.setHeader('Set-Cookie', [
          'authenticated=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
          'lastLogin=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        ]);
        return res.redirect('/login.html?session_expired=true');
      }
      
      // 更新最后活动时间
      await supabase
        .from('active_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('session_token', sessionToken);
      
      // 会话有效，继续处理请求
      return handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      
      // 发生错误时，默认允许请求继续，但记录错误
      return handler(req, res);
    }
  };
} 