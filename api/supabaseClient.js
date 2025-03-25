import { createClient } from '@supabase/supabase-js';

// Supabase配置信息（从环境变量获取）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase; 