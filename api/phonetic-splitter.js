const { createClient } = require('@supabase/supabase-js');

// Supabase配置信息
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 将音标字符串拆分为最小单位的音素数组 (针对英式英语 RP 优化版)。
 */
function splitPhoneticString(phoneticString, language = 'en-UK') {
    // 1. 输入验证
    if (typeof phoneticString !== 'string' || !phoneticString) {
        console.error('输入无效：phoneticString 必须是一个非空字符串。');
        return [];
    }

    if (typeof language !== 'string') {
        console.warn('无效的语言代码：language 必须是一个字符串。将使用默认语言 (en-UK)。');
        language = 'en-UK';
    }

    // 主要支持 en-UK 映射表，但保留结构以供未来可能的添加
    const supportedLanguages = ['en-UK', 'en-US'];
    if (!supportedLanguages.includes(language)) {
        console.warn(`不支持的语言代码：${language}。将使用默认语言 (en-UK)。音素映射表主要基于 en-UK。`);
        language = 'en-UK';
    }

    // 2. 预处理
    let cleanedString = phoneticString
        .replace(/[ˈˌ.]/g, '') // 移除重音和音节标记
        .replace(/^[\[\/]+|[\]\/]+$/g, ''); // 移除包围的 / 或 []
    cleanedString = cleanedString.normalize('NFC'); // Unicode 规范化

    // 3. 音素映射 (聚焦英式英语 RP)
    // 键是单个 IPA 音素（对于匹配逻辑，最长的优先很重要）
    // 值是包含结果音素字符串（或字符串数组）的数组。
    // *** 关键：辅音丛不在此处列出 ***
    const ipaMap = {
        // 三合元音 (处理为 双元音 + Schwa)
        'aɪə': ['aɪ', 'ə'], // 例如: fire /faɪər/ -> [ 'f', 'aɪ', 'ə', 'r' ] (RP r 可能不发音，但音素是r)
        'aʊə': ['aʊ', 'ə'], // 例如: hour /aʊər/ -> [ 'a', 'ʊ', 'ə', 'r' ]

        // 双元音
        'eɪ': ['eɪ'], // 例如: face /feɪs/
        'aɪ': ['aɪ'], // 例如: price /praɪs/
        'ɔɪ': ['ɔɪ'], // 例如: choice /tʃɔɪs/
        'əʊ': ['əʊ'], // 例如: goat /ɡəʊt/ (RP 特有, 相对于美式 /oʊ/)
		'oʊ': ['əʊ'],    // 美式写法转换为英式
        'aʊ': ['aʊ'], // 例如: mouth /maʊθ/
        'ɪə': ['ɪə'], // 例如: near /nɪər/
        'eə': ['eə'], // 例如: square /skweər/
        'ʊə': ['ʊə'], // 例如: cure /kjʊər/ (现在不太常见, 常与 /ɔː/ 合并)

        // 长元音
        'iː': ['iː'], // 例如: fleece /fliːs/
        'ɑː': ['ɑː'], // 例如: father /ˈfɑːðər/, start /stɑːt/
        'ɔː': ['ɔː'], // 例如: thought /θɔːt/, north /nɔːθ/
        'uː': ['uː'], // 例如: goose /ɡuːs/
        'ɜː': ['ɜː'], // 例如: nurse /nɜːs/

        // 短元音
        'ɪ': ['ɪ'], // 例如: kit /kɪt/
        'e': ['e'], // 例如: dress /dres/ (有时转录为 ɛ)
        'æ': ['æ'], // 例如: trap /træp/
        'ɒ': ['ɒ'], // 例如: lot /lɒt/, cloth /klɒθ/ (RP 特有)
        'ʌ': ['ʌ'], // 例如: strut /strʌt/, mud /mʌd/
        'ʊ': ['ʊ'], // 例如: foot /fʊt/, put /pʊt/
        'ə': ['ə'], // Schwa, 例如: about /əˈbaʊt/, common /ˈkɒmən/
		'i': ['ɪ'],      // kit 元音错误输入
        'ɛ': ['e'],      // dress 元音的变体（或反之，根据最终规范）
        'ɔ': ['ɒ'],      // lot 类词的常见错误
        'ɑ': ['ɑː'],     // father 类词可能缺少长音标记

        // 塞擦音
        'tʃ': ['tʃ'], // 例如: church /tʃɜːtʃ/
        'dʒ': ['dʒ'], // 例如: judge /dʒʌdʒ/

        // 辅音
        'ŋ': ['ŋ'], // 例如: sing /sɪŋ/
        'θ': ['θ'], // 例如: thin /θɪn/
        'ð': ['ð'], // 例如: this /ðɪs/
        'ʃ': ['ʃ'], // 例如: ship /ʃɪp/
        'ʒ': ['ʒ'], // 例如: pleasure /ˈpleʒər/
        'h': ['h'], // 例如: hit /hɪt/
        'w': ['w'], // 例如: wet /wet/
        'j': ['j'], // 例如: yes /jes/
        'r': ['r'], // 例如: red /red/ (RP 非卷舌音规则在语境中适用，但音素是 'r')
        'l': ['l'], // 例如: lip /lɪp/
        'm': ['m'], // 例如: map /mæp/
        'n': ['n'], // 例如: nap /næp/
        'p': ['p'], // 例如: pip /pɪp/
        'b': ['b'], // 例如: bib /bɪb/
        't': ['t'], // 例如: tin /tɪn/
        'd': ['d'], // 例如: did /dɪd/
        'k': ['k'], // 例如: kick /kɪk/
        'g': ['g'], // 例如: gig /ɡɪɡ/
        'f': ['f'], // 例如: fill /fɪl/
        'v': ['v'], // 例如: valve /vælv/
        's': ['s'], // 例如: sis /sɪs/
        'z': ['z'], // 例如: zoo /zuː/
    };

    // 创建一个按长度降序排序的键列表，以确保最长匹配优先
    const sortedKeys = Object.keys(ipaMap).sort((a, b) => b.length - a.length);

    // 4. 分词 (贪婪最长匹配)
    const segments = [];
    let remaining = cleanedString;

    while (remaining.length > 0) {
        let matchFound = false;
        for (const key of sortedKeys) {
            if (remaining.startsWith(key)) {
                segments.push(...ipaMap[key]); // 添加结果音素（或音素序列，如三合元音拆分后）
                remaining = remaining.slice(key.length); // 消耗匹配的部分
                matchFound = true;
                break; // 继续处理剩余字符串的下一部分
            }
        }

        if (!matchFound) {
            // 处理无法识别的字符
            // 检查它是否是已知的字符，只是缺少上下文（比如一个单独的附加符号）
            // 或者直接跳过它
            console.warn(`在 "${phoneticString}" 中发现无法识别的音标符号序列，以 "${remaining[0]}" 开头。正在跳过该字符。`);
            remaining = remaining.slice(1); // 跳过该字符以避免无限循环
        }
    }

    // 5. 输出
    return segments;
}

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
    const { phonetic } = req.body;
    
    if (!phonetic || typeof phonetic !== 'string') {
      return res.status(400).json({ error: '无效的请求格式' });
    }

    const phonemes = splitPhoneticString(phonetic);
    
    // 读取 phonemes.json 文件获取详情
    const fs = require('fs');
    const path = require('path');
    
    let phonemesData = {};
    try {
      const dataPath = path.join(process.cwd(), 'public', 'phonemes.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      phonemesData = JSON.parse(rawData);
    } catch (error) {
      console.error('Error reading phonemes data:', error);
      // 继续执行，返回没有详情的音素
    }
    
    // 构建带详情的音素数据
    const phonemeDetails = phonemes.map(phoneme => {
      let detail = null;
      
      // 在元音中查找
      if (phonemesData.元音 && phonemesData.元音[phoneme]) {
        detail = phonemesData.元音[phoneme];
      }
      // 在辅音中查找
      else if (phonemesData.辅音 && phonemesData.辅音[phoneme]) {
        detail = phonemesData.辅音[phoneme];
      }
      
      // 根据音素符号查找对应的音频文件
      let audioFileName;
      
      // 先检查是否有直接匹配的文件名 (例如: 'ɪ.MP3')
      try {
        const files = fs.readdirSync(path.join(process.cwd(), 'public', 'phonemes'));
        const matchingFile = files.find(file => {
          // 移除数字前缀和扩展名，检查剩余部分是否匹配音素
          const cleanName = file.replace(/^\d+-/, '').replace(/\.MP3$/i, '');
          return cleanName === phoneme;
        });
        
        if (matchingFile) {
          audioFileName = matchingFile;
        }
      } catch (error) {
        console.error('Error reading phonemes directory:', error);
      }
      
      // 如果没有找到匹配的文件，使用默认命名方案
      if (!audioFileName) {
        // 为不同类型的音素分配文件名
        if (detail && detail.type === '元音') {
          // 检查是否是双元音
          if (phoneme.length > 1) {
            // 双元音或长元音
            const vowelIndex = ['iː', 'ɪ', 'e', 'æ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ʌ', 'ɜː', 'ə', 
                              'eɪ', 'aɪ', 'ɔɪ', 'əʊ', 'aʊ', 'ɪə', 'eə', 'ʊə'].indexOf(phoneme) + 1;
            audioFileName = `${vowelIndex}-${phoneme}.MP3`;
          } else {
            // 单元音
            const vowelIndex = ['iː', 'ɪ', 'e', 'æ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ʌ', 'ɜː', 'ə'].indexOf(phoneme) + 1;
            audioFileName = `${vowelIndex}-${phoneme}.MP3`;
          }
        } else {
          // 辅音或其他
          const consonantIndex = ['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 
                                 'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'r', 'j', 'w'].indexOf(phoneme) + 21;
          audioFileName = `${consonantIndex}-${phoneme}.MP3`;
        }
      }
      
      return {
        symbol: phoneme,
        detail: detail || {
          symbol: phoneme,
          type: '未知',
          description: '未知音素',
          example: ''
        },
        audioUrl: `/phonemes/${audioFileName}` // 音频文件路径
      };
    });

    res.json({ 
      original: phonetic,
      phonemes: phonemeDetails
    });
  } catch (error) {
    console.error('Error processing phonetic:', error);
    res.status(500).json({ error: '服务器错误' });
  }
}; 
