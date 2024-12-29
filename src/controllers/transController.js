const openai = require("openai");
const jwt = require("jsonwebtoken");
const jwtSecret = process.env.JWT_SECRET;

const MOONSHOT_API_KEY = "sk-5SItFFYpHhECFAnKhZoovfvC7oEB89miktU2rru6hq0Je8Mt";
const temperature = 0.3;
let sysytemContent = "";
let systemContent = "";
const axios = require("axios");
require("dotenv").config(); // 确保环境变量被正确加载

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log(OPENAI_API_KEY);

const redisClient = require("../redis/redisClient");

const DAILY_LIMIT = 10;



// 添加新的翻译服务配置
const TRANSLATION_SERVICES = {
  chatgpt: {
    name: 'ChatGPT',
    endpoint: 'https://api.302.ai/v1/chat/completions',
  },
  google: {
    name: 'Google Translate',
    endpoint: 'https://translation.googleapis.com/language/translate/v2',
  },
  microsoft: {
    name: 'Microsoft Translator',
    endpoint: 'https://api.cognitive.microsofttranslator.com/translate',
  }
};

const MICROSOFT_CONFIG = {
  key: process.env.MICROSOFT_TRANSLATOR_KEY,
  region: process.env.MICROSOFT_TRANSLATOR_REGION,
  endpoint: process.env.MICROSOFT_TRANSLATOR_ENDPOINT
};

const { translate } = require('@vitalets/google-translate-api');
const tunnel = require('tunnel');



// 检查用户的剩余翻译次数
exports.checkQuota = async (req, res) => {

  // 检查请求中是否包含cookies

  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ loggedIn: false });
  }

  console.log("Object.keys(req.cookies):", Object.keys(req.cookies));
  console.log("req.cookies.jwt is: ", req.cookies.jwt);

  let userId = "";

  // 使用 promise 包裹 jwt.verify，等待验证完成
  try {
    const user = await new Promise((resolve, reject) => {
      jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
          console.log("40111");
          console.error("JWT verification failed:", err);
          return reject(err); // 抛出错误
        }
        resolve(user); // 成功时返回用户信息
      });
    });

    console.log("user is:", user);
    userId = user.id;
  } catch (err) {
    return res.status(401).json({ loggedIn: false });
  }


  try {

    const redisKey = `translate:count:${userId}`;

    // 获取当前使用次数
    let count = await redisClient.get(redisKey);
    count = count ? parseInt(count, 10) : 0;

    // 计算剩余次数
    const remainingQuota = Math.max(0, DAILY_LIMIT - count);

    console.log("count is: ", count);
    console.log("remainingQuota is: ", remainingQuota);

    // 增加计数并设置 24 小时过期时间
    const transaction = redisClient.multi();

    transaction
      .incr(redisKey) // 增加计数
      .expire(redisKey, 24 * 60 * 60); // 设置 24 小时过期时间

    const results = await transaction.exec(); // 执行事务

    // 检查事务执行的结果
    if (results && results[0] && results[0][0] !== null) {
      console.log("Redis transaction success");
    } else {
      console.log("Error in redis transaction", results);
    }

    // 检查是否超过限制
    const canTranslate = count <= DAILY_LIMIT;
    console.log("canTranslate is: ", canTranslate);

    return res.json({
      status: "success",
      data: {
        dailyLimit: DAILY_LIMIT,
        used: count,
        remaining: remainingQuota,
        canTranslate: canTranslate
      }
    });
  } catch (error) {
    console.error("Error checking quota:", error);
    return res.status(500).json({
      status: "error",
      message: "Error checking translation quota"
    });
  }
};


exports.input_trans = async (req, res) => {
  const { inputValue } = req.body; // 从请求中解构参数
  console.log("inputValue is: ", inputValue);

  try {
    // 根据模型调用不同的翻译服务
    const translation = await getInputTrans(inputValue);

    console.log("translations is", translation);

    return res.status(200).json(translation); // 返回所有译文
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.translate = async (req, res) => {
  // 检查请求中是否包含cookies

  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ loggedIn: false });
  }

  console.log("Object.keys(req.cookies):", Object.keys(req.cookies));
  console.log("req.cookies.jwt is: ", req.cookies.jwt);

  let userId = "";

  // 使用 promise 包裹 jwt.verify，等待验证完成
  try {
    const user = await new Promise((resolve, reject) => {
      jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
          console.log("40111");
          console.error("JWT verification failed:", err);
          return reject(err); // 抛出错误
        }
        resolve(user); // 成功时返回用户信息
      });
    });

    console.log("user is:", user);
    userId = user.id;
  } catch (err) {
    return res.status(401).json({ loggedIn: false });
  }

  const today = new Date().toISOString().split("T")[0];
  const redisKey = `translate_limit:${userId}:${today}`;

  console.log("redisKey is: ", redisKey);

  const { sourceLangCode, targetLangCode, textInputValue, selectedModels } = req.body; // 从请求中解构参数
  console.log(sourceLangCode, targetLangCode, textInputValue, selectedModels);

  // 校验 textInputValue 长度
  if (textInputValue.length > 2000) {
    return res.status(400).json({
      status: "error",
      message: "输入文本超过了2000字的限制，请缩短文本后再试。",
    });
  }

  const translations = {}; // 用于存储不同模型的译文

  try {
    // // 检查用户的翻译次数
    // let count = await redisClient.get(redisKey);
    // count = count ? parseInt(count, 10) : 0;

    // console.log("count is: ", count);

    // if (count >= DAILY_LIMIT) {
    //   return res.json({
    //     status: "error",
    //     message: "已超过设限10次, 请明天再试",
    //   });
    // }

    // // 增加计数并设置 24 小时过期时间
    // const transaction = redisClient.multi();

    // transaction
    //   .incr(redisKey) // 增加计数
    //   .expire(redisKey, 24 * 60 * 60); // 设置 24 小时过期时间

    // const results = await transaction.exec(); // 执行事务

    // // 检查事务执行的结果
    // if (results && results[0] && results[0][0] !== null) {
    //   console.log("Redis transaction success");
    // } else {
    //   console.log("Error in redis transaction", results);
    // }

    for (const model of selectedModels) {
      console.log("model is:", model);
      // 根据模型调用不同的翻译服务
      const translation = await getTranslation(model, sourceLangCode, targetLangCode, textInputValue);
      console.log("333sourceLangCode is: ", sourceLangCode);
      console.log("333targetLangCode is: ", targetLangCode);
      translations[model] = translation; // 存储译文
    }

    console.log("translations is", translations);

    return res.status(200).json(translations); // 返回所有译文
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// 重置用户的翻译次数
exports.resetQuota = async (req, res) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ loggedIn: false });
  }

  try {
    const user = await new Promise((resolve, reject) => {
      jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
          console.error("JWT verification failed:", err);
          return reject(err);
        }
        resolve(user);
      });
    });

    const userId = user.id;
    const redisKey = `translate:count:${userId}`;

    // 重置翻译次数
    await redisClient.set(redisKey, 0);

    return res.json({
      status: "success",
      message: "Translation quota has been reset"
    });
  } catch (error) {
    console.error("Error resetting quota:", error);
    return res.status(500).json({
      status: "error",
      message: "Error resetting translation quota"
    });
  }
};

async function getTranslation(model, sourceLang, targetLang, textInput) {
  // 标准化语言代码
  console.log("sourceLang is: ", sourceLang);
  console.log("targetLang is: ", targetLang);
  const fromLang = normalizeLanguageCode(sourceLang, model);
  const toLang = normalizeLanguageCode(targetLang, model);

  const cacheKey = `translation:${model}:${fromLang}:${toLang}:${Buffer.from(textInput).toString('base64')}`;

  try {
    // 检查缓存
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log('Cache hit for translation');
      return cachedResult;
    }

    let result;
    switch (model.toLowerCase()) {
      case 'microsoft':
        console.log("11111111")
        result = await microsoftTranslate(textInput, fromLang, toLang);
        console.log("result from microsoft is:", result)
        break;
      case 'chatgpt':
        // 现有的 ChatGPT 实现
        console.log("22222222")
        result = await translateWithChatGPT(textInput, fromLang, toLang);
        console.log("result from chatgpt is:", result)
        break;
      case 'google':
        console.log("33333333")
        result = await translateWithGoogle(textInput, fromLang, toLang);
        console.log("result from google is:", result)
        break;
      default:
        throw new Error(`Unsupported translation model: ${model}`);
    }

    // 缓存结果
    if (result) {
      // 使用新版本的 Redis set 方法，设置 24 小时过期时间
      await redisClient.set(cacheKey, result, {
        EX: 24 * 60 * 60 // 24小时过期时间（秒）
      });
    }

    return result;
  } catch (error) {
    console.error(`Translation error (${model}):`, error);
    throw error;
  }
}

// 语言代码映射
const LANGUAGE_CODE_MAPPING = {
  microsoft: {
    'zh': 'zh-Hans',     // 简体中文
    'zh-CN': 'zh-Hans',
    'zh-TW': 'zh-Hant',  // 繁体中文
    'en': 'en',
    'ja': 'ja',          // 日语
    'ko': 'ko',          // 韩语

  },
  google: {
    'zh': 'zh-CN',       // 简体中文
    'zh-Hans': 'zh-CN',
    'zh-Hant': 'zh-TW',  // 繁体中文
    'en': 'en',
    'ja': 'ja',          // 日语
    'ko': 'ko',          // 韩语

  },
  chatgpt: {
    'zh': 'zh-CN',       // 简体中文
    'zh-Hans': 'zh-CN',
    'zh-Hant': 'zh-TW',  // 繁体中文
    'en': 'en',
    'ja': 'ja',          // 日语
    'ko': 'ko',          // 韩语

  }
};

// 标准化语言代码
function normalizeLanguageCode(lang, service = 'microsoft') {
  const mapping = LANGUAGE_CODE_MAPPING[service];
  return mapping[lang] || lang;
}

// Microsoft Translator 实现
async function microsoftTranslate(text, fromLang, toLang) {
  console.log("fromLang is: ", fromLang);
  console.log("toLang is: ", toLang);
  console.log("text is: ", text);
  try {
    const response = await axios({
      baseURL: MICROSOFT_CONFIG.endpoint,
      url: '/translate',
      method: 'post',
      headers: {
        'Ocp-Apim-Subscription-Key': MICROSOFT_CONFIG.key,
        'Ocp-Apim-Subscription-Region': MICROSOFT_CONFIG.region,
        'Content-type': 'application/json',
      },
      params: {
        'api-version': '3.0',
        'from': fromLang,
        'to': toLang
      },
      data: [{
        'text': text
      }],
      timeout: 10000 // 10秒超时
    });

    if (!response.data?.[0]?.translations?.[0]?.text) {
      console.error('Invalid response format from Microsoft Translator');
      return text;
      // throw new Error('Invalid response from Microsoft Translator');
    }

    return response.data[0].translations[0].text;
  } catch (error) {
    console.error('Microsoft translation failed:', error.message);
    return text;
  }
}

// ChatGPT 翻译实现
async function translateWithChatGPT(text, sourceLang, targetLang) {
  // const systemPrompt = `你是一个专业的翻译助手。请将文本从${sourceLang}准确翻译成${targetLang}。
  // 翻译要求：
  // 1. 保持原文的意思和语气
  // 2. 确保专业术语的准确性
  // 3. 保持文本格式
  // 4. 只返回翻译结果，不要添加解释或其他内容`;
  try {
    const systemPrompt = `你是一个翻译助手。请将文本${text}从${sourceLang}翻译成${targetLang}。直接返回翻译结果，不要添加任何其他内容，不要添加"Translation:"等前缀，不要用引号包裹，不要添加解释。`;

    console.log("TRANSLATION_SERVICES.chatgpt.endpoint is:", TRANSLATION_SERVICES.chatgpt.endpoint);
    const response = await axios.post(
      TRANSLATION_SERVICES.chatgpt.endpoint,
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000 // 10秒超时
      }
    );

    // if (!response.data?.choices?.[0]?.message?.content) {
    //   throw new Error('Invalid response format from ChatGPT API');
    // }
    if (!response.data?.choices?.[0]?.message?.content) {
      console.error('Invalid response format from ChatGPT');
      return text;
    }

    // 清理结果，移除可能的前缀和多余的格式
    let result = response.data.choices[0].message.content.trim();
    result = result.replace(/^(Translation:|翻译:|译文:|结果:)/i, '').trim();
    result = result.replace(/^["']|["']$/g, '').trim();

    return result;

    // return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('ChatGPT translation failed:', error.message);
    return text;
  }
}

// Google 翻译实现
async function translateWithGoogle(text, sourceLang, targetLang) {
  console.log("Google Translate Input:", { text, sourceLang, targetLang });
  try {
    // 转换语言代码格式
    const from = sourceLang.split('-')[0]; // 取主要语言代码
    const to = targetLang.split('-')[0];   // 例如 'zh-CN' -> 'zh'

    const response = await translate(text, {
      from,
      to,
      // 可选：添加代理支持
      // agent: tunnel.httpsOverHttp({
      //   proxy: {
      //     host: 'proxy.example.com',
      //     port: 8080
      //   }
      // })
      timeout: 10000 // 10秒超时
    });

    if (!response.text) {
      // throw new Error('No translation result');
      console.error('No translation result from Google');
      return text;
    }
    return response.text;
  } catch (error) {
    console.error('Google translation failed:', error.message);
    return text;
  }
}

async function getInputTrans(inputValue) {
  sysytemContent = "请将以下中文翻译成英文：";

  try {
    const response = await axios.post(
      "https://api.302.ai/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: "请将以下中文翻译成英文（只显示译文）：" + inputValue,
          },
          // 添加一条消息以清除上下文
          // { role: "system", content: "清除上下文" },
        ],
        // max_tokens: req.body.max_tokens || 100, // optional
        // temperature: req.body.temperature || 0.7 // optional
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`, // 确保使用正确的 API 密钥
          "Content-Type": "application/json", // 确保内容类型正确
          Accept: "application/json", // 确保接受的内容类型正确
          // 其他可能需要的头部
        },
      }
    );
    // console.log(response);

    const result = response.data;

    let content11 = "";

    // 检查 choices 是否存在并且有元素
    if (result.choices && result.choices.length > 0) {
      content11 = result.choices[0].message.content;
      console.log("Content:", content11); // 输出: Content: Hi there! How can I assist you today?
    } else {
      console.error("No choices available in the result.");
    }

    // res.json(content11);
    // return res.status(200).json({
    //   translation: content11,
    // });

    return content11;
  } catch (error) {
    console.error("Error:", error);
    // return res.status(500).json({ error: "Error contacting OpenAI API" });
  }

  // 根据模型调用不同的翻译 API
  // 这里可以根据具体的模型逻辑进行实现
  // 示例返回
}

exports.generate = async (req, res) => {
  const { category, content } = req.body;
  const { theme, mimic, keys } = content;
  const structure =
    "[Verse 1]\nThe first part of the lyrics, establish the theme\n[Chorus]\nThe refrain section, full of energy\n[Verse 2]\nThe second part of the lyrics, increase the conflict or develop the story\n[Chorus]\nRepeat the refrain\n[Solo]\nThe instrumental solo section, usually the guitar\n[Bridge]\nThe transition section, bringing new elements\n[Chorus]\nRepeat the refrain again\n";

  console.log("category is: ", category);
  console.log("content is: ", content);
  if (category == "lyricsGens") {
    systemContent = `Assuming you are a professional music producer, forget the previous conversation, please focus only on the following content now: creating a theme about '${theme}', please mimic the style of '${mimic}', incorporating the following keywords '${keys}', to create a touching song. The lyrics are given in the following structure: ${structure}. Please ensure that the lyrics are poetic and resonate with the audience. The answer should only include the lyrics, without any other content.`;
  } else if (category == "songGens") {
    // sysytemContent =
    //   "假设你是一个专业的音乐制作人, 对于如下给出的关键字, 模仿罗大佑的曲风，为用户生成提示词以确保能产出专业、高质量的歌曲，返回的提示词字数限制在200字以内";
    systemContent = `Assuming you are a professional music producer, forget the previous conversation, please focus only on the following content now: creating a theme about '${theme}', please mimic the style of '${mimic}' and combine the following keywords '${keys}' to generate a simple creative prompts for users to ensure the production of professional songs, ensure that the prompts result you generated do not exceed 200 characters.`;
  } else {
    systemContent =
      "You are a GTP, specialized in conversations between Chinese and English. You provide safe, helpful, and accurate answers to users. At the same time, you reject answers related to terrorism, racism, and explicit violence. MoonshotAI is a proper noun and should not be translated into other languages.";
  }

  console.log("systemContent is: ", systemContent);

  // const systemContent =
  // "假设你是一个专业的音乐制作人, 对于如下给出的关键字，为用户生成专业的歌词, 歌词的结构如下：'[Instrumetal intro]\n强劲的乐器前奏\n[Verse 1]\n第一段歌词，建立主题\n[Chorus]\n副歌部分，充满能量\n[Verse 2]\n第二段歌词，增加冲突或发展故事\n[Chorus]\n重复副歌\n[Solo]\n乐器独奏部分，通常是吉他\n[Bridge]\n过渡部分，带来新的元素\n[Chorus]\n再次重复副歌\n[Outro]\n结束部分，可能是乐器的渐弱'。请确保生成的歌词或曲风中不包含当前给定的关键词，而是根据关键词的意境进行展开。";
  // const systemContent =    "假设你是一个专业的音乐制作人, 对于如下给出的关键字, 模仿中国宋词的风格，为用户生成专业的歌词, 歌词的结构如下：'[Verse 1]\n第一段歌词，建立主题\n[Chorus]\n副歌部分，充满能量\n[Verse 2]\n第二段歌词，增加冲突或发展故事\n[Chorus]\n重复副歌\n[Solo]\n乐器独奏部分，通常是吉他\n[Bridge]\n过渡部分，带来新的元素\n[Chorus]\n再次重复副歌'。请确保生成的歌词或曲风中不包含当前给定的关键词，而是根据关键词的意境进行展开。";

  try {
    const response = await axios.post(
      "https://api.302.ai/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: keys,
          },
          // 添加一条消息以清除上下文
          // { role: "system", content: "清除上下文" },
        ],
        // max_tokens: req.body.max_tokens || 100, // optional
        // temperature: req.body.temperature || 0.7 // optional
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`, // 确保使用正确的 API 密钥
          "Content-Type": "application/json", // 确保内容类型正确
          Accept: "application/json", // 确保接受的内容类型正确
          // 其他可能需要的头部
        },
      }
    );
    // console.log(response);

    const result = response.data;

    let content11 = "";

    // 检查 choices 是否存在并且有元素
    if (result.choices && result.choices.length > 0) {
      content11 = result.choices[0].message.content;
      console.log("Content:", content11); // 输出: Content: Hi there! How can I assist you today?
    } else {
      console.error("No choices available in the result.");
    }

    // res.json(content11);
    return res.status(200).json({
      answer: content11,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Error contacting OpenAI API" });
  }
};

// 获取 Microsoft Translator API 使用统计
async function getMicrosoftTranslatorUsage() {
  try {
    const response = await axios({
      method: 'get',
      url: 'https://api.cognitive.microsofttranslator.com/billing/usage',
      headers: {
        'Ocp-Apim-Subscription-Key': MICROSOFT_CONFIG.key,
        'Ocp-Apim-Subscription-Region': MICROSOFT_CONFIG.region
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error getting Microsoft Translator usage:', error);
    throw error;
  }
}

// API 端点获取使用统计
exports.getMicrosoftUsage = async (req, res) => {
  try {
    const usage = await getMicrosoftTranslatorUsage();
    res.json({
      status: 'success',
      data: usage
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get Microsoft Translator usage',
      error: error.message
    });
  }
};

// Uptime Robot 监控端点
exports.monitorUsage = async (req, res) => {
  try {
    const usage = await getMicrosoftTranslatorUsage();
    const characterCount = usage.characterCount || 0;
    const limit = 2000000; // 200万字符限制
    const usagePercent = (characterCount / limit) * 100;

    // 如果使用量超过80%，返回HTTP 429状态码触发 Uptime Robot 警报
    if (usagePercent > 80) {
      return res.status(429).json({
        status: 'warning',
        message: `API usage high: ${usagePercent.toFixed(2)}%`,
        data: {
          used: characterCount,
          limit: limit,
          percentage: usagePercent
        }
      });
    }

    // 正常情况返回 HTTP 200
    res.json({
      status: 'ok',
      data: {
        used: characterCount,
        limit: limit,
        percentage: usagePercent
      }
    });
  } catch (error) {
    // 如果获取使用量失败，返回HTTP 500触发警报
    res.status(500).json({
      status: 'error',
      message: 'Failed to get usage data',
      error: error.message
    });
  }
};
