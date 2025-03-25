# 单词助手应用

这是一个基于Vercel部署的单词助手应用，具有单设备登录限制功能。

## 功能特点

- 单词查询和解释
- 文本转语音
- 安全的密码验证
- 单设备登录限制（一个密码只能在一个设备上登录使用）

## 技术栈

- Vercel Serverless Functions
- Supabase (PostgreSQL数据库)
- Azure语音服务
- Google Gemini AI服务

## 部署步骤

### 1. Supabase设置

1. 创建Supabase账户：https://supabase.com
2. 创建新项目
3. 创建`active_sessions`数据表，包含以下列：
   - `id`: integer, primary key
   - `password_hash`: varchar(64)
   - `session_token`: varchar(64)
   - `device_info`: text
   - `ip_address`: varchar(45)
   - `last_activity`: timestamptz, default: now()
   - `created_at`: timestamptz, default: now()
4. 创建索引：
   ```sql
   CREATE INDEX idx_password_hash ON active_sessions(password_hash);
   CREATE INDEX idx_session_token ON active_sessions(session_token);
   ```
5. 获取项目URL和公共API密钥（在项目设置 > API中）

### 2. Vercel部署

1. Fork或克隆此仓库
2. 在Vercel中导入项目
3. 设置以下环境变量：
   - `SUPABASE_URL`: Supabase项目URL
   - `SUPABASE_ANON_KEY`: Supabase公共API密钥
   - `ACCESS_PASSWORDS`: 用于访问的密码，多个密码用逗号分隔
   - `GEMINI_API_KEY`: Google Gemini API密钥
   - `AZURE_SPEECH_KEY`: Azure语音服务密钥
   - `AZURE_SPEECH_REGION`: Azure语音服务区域（默认: eastasia）
4. 点击部署

### 3. 本地开发

1. 克隆仓库
2. 安装依赖: `npm install`
3. 创建`.env.local`文件并设置环境变量
4. 运行开发服务器: `npm run dev`

## 注意事项

- 单设备登录功能会导致已登录的设备在新设备登录时被踢出
- 会话默认24小时过期
- 为提高安全性，请定期更改访问密码 