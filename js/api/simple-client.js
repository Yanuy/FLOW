/**
 * 简化版API客户端 - 专注核心功能
 * 直接集成到nodes系统中
 */
class SimpleAPIClient {
    constructor() {
        this.config = this.getDefaultConfig();
        this.loadConfig();
    }

    // 获取默认配置
    getDefaultConfig() {
        return {
            apiKey: 'sk-qJv60VOOREcVfbwnCvF49vaNgA4cSF91BEu8BESa7DCPptFq',
            baseUrl: 'https://api.chatanywhere.tech/v1',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 10000,
            timeout: 30000,
            debug: true // 启用调试模式
        };
    }

    // 加载配置
    loadConfig() {
        try {
            const saved = localStorage.getItem('simple-api-config');
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('加载API配置失败:', error);
        }
    }

    // 保存配置
    saveConfig() {
        try {
            localStorage.setItem('simple-api-config', JSON.stringify(this.config));
        } catch (error) {
            console.error('保存API配置失败:', error);
        }
    }

    // 更新配置
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
    }

    // 统一的HTTP请求方法
    async makeRequest(endpoint, payload, options = {}) {
        const url = this.config.baseUrl + endpoint;

        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'User-Agent': 'AgentFlow/2.0',
            ...options.headers
        };

        const requestOptions = {
            method: options.method || 'POST',
            headers,
            signal: AbortSignal.timeout(this.config.timeout)
        };

        // 处理不同类型的payload
        if (payload instanceof FormData) {
            requestOptions.body = payload;
            console.log(`[SimpleAPIClient] FormData请求到 ${endpoint}`);
        } else if (requestOptions.method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            requestOptions.body = JSON.stringify(payload);
            console.log(`[SimpleAPIClient] JSON请求到 ${endpoint}:`, payload);
        }

        try {
            const response = await fetch(url, requestOptions);
            console.log(`[SimpleAPIClient] 响应状态: ${response.status} for ${endpoint}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[SimpleAPIClient] 错误响应:`, errorText);

                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: { message: errorText } };
                }

                throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error('请求超时');
            }
            console.error(`[SimpleAPIClient] 请求失败:`, error);
            throw error;
        }
    }

    // 文本对话
    async chatCompletion(messages, options = {}) {
        // 处理不同的输入格式
        let formattedMessages;
        if (typeof messages === 'string') {
            formattedMessages = [{ role: 'user', content: messages }];
        } else if (Array.isArray(messages)) {
            formattedMessages = messages;
        } else {
            throw new Error('messages 参数格式错误');
        }

        const payload = {
            model: options.model || this.config.model,
            messages: formattedMessages,
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens
        };

        console.log(`[SimpleAPIClient] 聊天请求:`, payload);

        try {
            const result = await this.makeRequest('/chat/completions', payload);
            console.log(`[SimpleAPIClient] 聊天响应:`, result);

            // 处理不同的响应格式
            const choice = result.choices?.[0] || result.choice || result;
            const message = choice.message || choice;

            return {
                content: message.content || message.text || result.content || result.text,
                usage: result.usage || {},
                model: result.model || payload.model
            };
        } catch (error) {
            console.error(`[SimpleAPIClient] 聊天失败:`, error);
            throw error;
        }
    }

    // 图像生成
    async generateImage(params) {
        // 支持两种调用方式：generateImage(prompt) 或 generateImage({prompt, options})
        let prompt, options = {};

        if (typeof params === 'string') {
            prompt = params;
        } else if (typeof params === 'object') {
            prompt = params.prompt;
            options = params;
        } else {
            throw new Error('generateImage 参数必须是字符串或对象');
        }

        // 检测不同的API格式
        const isStandardOpenAI = this.config.baseUrl.includes('api.openai.com') ||
            this.config.baseUrl.includes('api.chatanywhere.tech');

        let payload;
        if (isStandardOpenAI) {
            // 标准 OpenAI API 格式
            payload = {
                prompt,
                model: options.model || 'dall-e-3',
                n: options.n || options.count || 1,
                size: options.size || '1024x1024',
                quality: options.quality || 'standard'
            };
        } else {
            // 可能是其他API格式，尝试更简单的格式
            payload = {
                prompt: prompt,
                model: options.model || 'dall-e-3',
                n: options.n || options.count || 1,
                size: options.size || '1024x1024'
            };
        }

        console.log(`[SimpleAPIClient] 图像生成请求:`, payload);

        try {
            const result = await this.makeRequest('/images/generations', payload);
            console.log(`[SimpleAPIClient] 图像生成响应:`, result);

            // 处理不同的响应格式
            const imageData = result.data || result.images || [result];

            return {
                data: Array.isArray(imageData) ? imageData.map(item => ({
                    url: item.url || item.image_url || item,
                    revised_prompt: item.revised_prompt || prompt
                })) : [{
                    url: imageData.url || imageData.image_url || imageData,
                    revised_prompt: imageData.revised_prompt || prompt
                }]
            };
        } catch (error) {
            console.error(`[SimpleAPIClient] 图像生成失败:`, error);

            // 如果是序列化错误，尝试简化的格式
            if (error.message.includes('Cannot deserialize') || error.message.includes('JsonToken')) {
                console.log(`[SimpleAPIClient] 尝试简化格式...`);

                const simplePayload = {
                    prompt: prompt  // 只发送最基本的参数
                };

                try {
                    const result = await this.makeRequest('/images/generations', simplePayload);
                    console.log(`[SimpleAPIClient] 简化格式成功:`, result);

                    const imageData = result.data || result.images || [result];
                    return {
                        data: Array.isArray(imageData) ? imageData.map(item => ({
                            url: item.url || item.image_url || item,
                            revised_prompt: item.revised_prompt || prompt
                        })) : [{
                            url: imageData.url || imageData.image_url || imageData,
                            revised_prompt: imageData.revised_prompt || prompt
                        }]
                    };
                } catch (fallbackError) {
                    console.error(`[SimpleAPIClient] 简化格式也失败:`, fallbackError);
                    throw fallbackError;
                }
            }

            throw error;
        }
    }

    // 图像编辑
    async editImage(params) {
        // 支持对象参数：{image, prompt, mask?, model?, size?}
        const { image, prompt, mask, model = 'dall-e-2', size = '1024x1024' } = params;

        const formData = new FormData();
        formData.append('image', image);
        formData.append('prompt', prompt);
        formData.append('model', model);
        formData.append('size', size);

        if (mask) {
            formData.append('mask', mask);
        }

        const result = await this.makeRequest('/images/edits', formData);
        return {
            data: result.data.map(item => ({ url: item.url }))
        };
    }

    // 图像变换
    async createImageVariation(params) {
        // 支持对象参数：{image, model?, n?, size?}
        const { image, model = 'dall-e-2', n = 1, size = '1024x1024' } = params;

        const formData = new FormData();
        formData.append('image', image);
        formData.append('model', model);
        formData.append('n', n.toString());
        formData.append('size', size);

        const result = await this.makeRequest('/images/variations', formData);
        return {
            data: result.data.map(item => ({ url: item.url }))
        };
    }

    // 音频转录
    async transcribeAudio(params) {
        // 支持对象参数：{file, model?, language?, prompt?}
        const { file, model = 'whisper-1', language, prompt } = params;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', model);

        if (language) formData.append('language', language);
        if (prompt) formData.append('prompt', prompt);

        const result = await this.makeRequest('/audio/transcriptions', formData);
        return {
            text: result.text,
            language: result.language
        };
    }

    // 文本转语音
    async textToSpeech(params) {
        // 支持对象参数：{input, model?, voice?, speed?}
        const { input, model = 'tts-1', voice = 'alloy', speed = 1.0 } = params;

        const payload = {
            model,
            input,
            voice,
            speed
        };

        // 注意：TTS返回的是音频数据，不是JSON
        const response = await fetch(this.config.baseUrl + '/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`TTS请求失败: ${response.status}`);
        }

        const audioBlob = await response.blob();
        return audioBlob;  // 直接返回Blob，保持与nodes.js的期望一致
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.simpleAPIClient = new SimpleAPIClient();

    // 向后兼容
    window.apiClient = window.simpleAPIClient;
    window.modernAPIClient = window.simpleAPIClient;
}
