// 对话窗口组件 - 独立的AI聊天界面
class ConversationWindow {
    constructor(config = {}) {
        this.id = config.id || Utils.generateId('conv_');
        this.title = config.title || 'AI对话窗口';
        this.agentId = config.agentId || 'default-chat';
        this.position = config.position || { x: 100, y: 100 };
        this.size = config.size || { width: 400, height: 600 };
        this.isMinimized = false;
        this.isVisible = false;

        // 对话相关
        this.messages = [];
        this.isWaitingResponse = false;
        this.conversation = null;

        // UI元素
        this.windowElement = null;
        this.messagesContainer = null;
        this.inputElement = null;
        this.sendButton = null;
        this.voiceButton = null;
        this.exportButton = null;

        // 语音相关
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];

        this.createWindow();
        this.bindEvents();
    }

    // 创建窗口DOM结构
    createWindow() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'conversation-window';
        this.windowElement.id = this.id;
        this.windowElement.style.cssText = `
            position: fixed;
            left: ${this.position.x}px;
            top: ${this.position.y}px;
            width: ${this.size.width}px;
            height: ${this.size.height}px;
            z-index: 10000;
            display: none;
        `;

        this.windowElement.innerHTML = `
            <div class="conv-window-header">
                <div class="conv-window-title">
                    <i class="fas fa-comments"></i>
                    <span class="title-text">${this.title}</span>
                </div>
                <div class="conv-window-controls">
                    <button class="conv-btn conv-btn-settings" id="settingsBtn-${this.id}" title="设置">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="conv-btn conv-btn-node" id="nodeBtn-${this.id}" title="生成节点">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    <button class="conv-btn conv-btn-minimize" title="折叠">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="conv-btn conv-btn-close" title="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="conv-window-body" id="windowBody-${this.id}">
                <!-- 设置面板 -->
                <div class="conv-settings-panel" id="settingsPanel-${this.id}" style="display: none;">
                    <div class="setting-section">
                        <label>模型选择:</label>
                        <select class="conv-select" id="modelSelect-${this.id}">
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            <option value="gpt-4">GPT-4</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                            <option value="local-model">本地模型</option>
                        </select>
                    </div>
                    
                    <div class="setting-section">
                        <label>预设角色:</label>
                        <select class="conv-select" id="promptSelect-${this.id}">
                            <option value="default">通用助手</option>
                            <option value="coder">编程助手</option>
                            <option value="writer">写作助手</option>
                            <option value="analyst">数据分析师</option>
                            <option value="translator">翻译助手</option>
                            <option value="custom">自定义</option>
                        </select>
                    </div>
                    
                    <div class="setting-section" id="customPromptSection-${this.id}" style="display: none;">
                        <label>自定义提示词:</label>
                        <textarea class="conv-textarea" id="customPrompt-${this.id}" 
                                  placeholder="输入自定义的系统提示词..." rows="3"></textarea>
                    </div>
                    
                    <div class="setting-section">
                        <label>Temperature: <span id="tempValue-${this.id}">0.7</span></label>
                        <input type="range" class="conv-slider" id="temperature-${this.id}" 
                               min="0" max="2" step="0.1" value="0.7">
                    </div>
                </div>
                
                <div class="conv-messages-container" id="messages-${this.id}">
                    <div class="conv-welcome-message">
                        <div class="message-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="message-content">
                            <div class="message-text">
                                您好！我是AI助手，有什么可以帮助您的吗？
                            </div>
                            <div class="message-time">
                                ${new Date().toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="conv-input-area">
                    <div class="conv-input-controls">
                        <div class="input-controls-left">
                            <button class="conv-btn conv-btn-attach" id="attachBtn-${this.id}" title="上传文件">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button class="conv-btn conv-btn-voice" id="voiceBtn-${this.id}" title="语音输入">
                                <i class="fas fa-microphone"></i>
                            </button>
                        </div>
                        <div class="input-controls-right">
                            <button class="conv-btn conv-btn-export" id="exportBtn-${this.id}" title="导出对话">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="conv-btn conv-btn-clear" id="clearBtn-${this.id}" title="清空对话">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="conv-input-box">
                        <textarea 
                            class="conv-input" 
                            id="input-${this.id}" 
                            placeholder="输入消息... (Shift+Enter换行)"
                            rows="1"
                        ></textarea>
                        <button class="conv-btn conv-btn-send" id="sendBtn-${this.id}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    
                    <div class="conv-status-bar">
                        <span class="conv-status-text" id="status-${this.id}">就绪</span>
                        <span class="conv-message-count">消息: <span id="msgCount-${this.id}">0</span></span>
                    </div>
                </div>
            </div>
            
            <!-- 隐藏的文件输入 -->
            <input type="file" id="fileInput-${this.id}" style="display: none;" 
                   accept=".txt,.md,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif" multiple>
        `;

        document.body.appendChild(this.windowElement);

        // 获取DOM元素引用
        this.messagesContainer = document.getElementById(`messages-${this.id}`);
        this.inputElement = document.getElementById(`input-${this.id}`);
        this.sendButton = document.getElementById(`sendBtn-${this.id}`);
        this.voiceButton = document.getElementById(`voiceBtn-${this.id}`);
        this.exportButton = document.getElementById(`exportBtn-${this.id}`);
        this.clearButton = document.getElementById(`clearBtn-${this.id}`);
        this.attachButton = document.getElementById(`attachBtn-${this.id}`);
        this.nodeButton = document.getElementById(`nodeBtn-${this.id}`);
        this.settingsButton = document.getElementById(`settingsBtn-${this.id}`);
        this.statusElement = document.getElementById(`status-${this.id}`);
        this.messageCountElement = document.getElementById(`msgCount-${this.id}`);
        this.settingsPanel = document.getElementById(`settingsPanel-${this.id}`);
        this.fileInput = document.getElementById(`fileInput-${this.id}`);

        // 配置相关元素
        this.modelSelect = document.getElementById(`modelSelect-${this.id}`);
        this.promptSelect = document.getElementById(`promptSelect-${this.id}`);
        this.customPrompt = document.getElementById(`customPrompt-${this.id}`);
        this.temperatureSlider = document.getElementById(`temperature-${this.id}`);
        this.tempValueDisplay = document.getElementById(`tempValue-${this.id}`);

        // 节点相关
        this.linkedNode = null;
        this.nodeCreated = false;
    }

    // 绑定事件
    bindEvents() {
        // 窗口拖拽
        this.makeDraggable();

        // 发送消息
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 语音输入
        this.voiceButton.addEventListener('click', () => this.toggleVoiceInput());

        // 文件上传
        this.attachButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // 导出对话
        this.exportButton.addEventListener('click', () => this.exportConversation());

        // 清空对话
        this.clearButton.addEventListener('click', () => this.clearConversation());

        // 节点生成
        this.nodeButton.addEventListener('click', () => this.toggleNode());

        // 设置面板
        this.settingsButton.addEventListener('click', () => this.toggleSettings());

        // 设置控件事件
        this.bindSettingsEvents();

        // 窗口控制
        this.windowElement.querySelector('.conv-btn-minimize').addEventListener('click', () => this.minimize());
        this.windowElement.querySelector('.conv-btn-close').addEventListener('click', () => this.close());

        // 输入框自动调整高度
        this.inputElement.addEventListener('input', () => this.adjustInputHeight());
    }

    // 绑定设置事件
    bindSettingsEvents() {
        // 模型选择
        this.modelSelect.addEventListener('change', (e) => {
            this.updateAgentConfig('model', e.target.value);
        });

        // 预设提示词选择
        this.promptSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            const customSection = document.getElementById(`customPromptSection-${this.id}`);

            if (value === 'custom') {
                customSection.style.display = 'block';
            } else {
                customSection.style.display = 'none';
                this.updateAgentConfig('prompt', this.getPresetPrompt(value));
            }
        });

        // 自定义提示词
        this.customPrompt.addEventListener('input', (e) => {
            if (this.promptSelect.value === 'custom') {
                this.updateAgentConfig('prompt', e.target.value);
            }
        });

        // Temperature滑块
        this.temperatureSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.tempValueDisplay.textContent = value.toFixed(1);
            this.updateAgentConfig('temperature', value);
        });
    }    // 使窗口可拖拽
    makeDraggable() {
        const header = this.windowElement.querySelector('.conv-window-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = this.position.x;
        let yOffset = this.position.y;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.conv-window-controls')) return;

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                this.windowElement.style.zIndex = '10001';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.windowElement.style.left = currentX + 'px';
                this.windowElement.style.top = currentY + 'px';
            }
        });

        document.addEventListener('mouseup', (e) => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            this.windowElement.style.zIndex = '10000';
        });
    }

    // 显示窗口
    show() {
        this.windowElement.style.display = 'block';
        this.isVisible = true;
        this.inputElement.focus();
    }

    // 隐藏窗口
    hide() {
        this.windowElement.style.display = 'none';
        this.isVisible = false;
    }

    // 最小化
    minimize() {
        const windowBody = document.getElementById(`windowBody-${this.id}`);
        if (this.isMinimized) {
            windowBody.style.display = 'block';
            this.windowElement.querySelector('.conv-btn-minimize i').className = 'fas fa-minus';
            this.windowElement.style.height = this.size.height + 'px';
            this.isMinimized = false;
        } else {
            windowBody.style.display = 'none';
            this.windowElement.querySelector('.conv-btn-minimize i').className = 'fas fa-plus';
            this.windowElement.style.height = '48px'; // 只显示标题栏
            this.isMinimized = true;
        }
    }

    // 关闭窗口
    close() {
        this.hide();
        // 可以选择是否销毁窗口
        // this.destroy();
    }

    // 销毁窗口
    destroy() {
        if (this.windowElement) {
            this.windowElement.remove();
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    // 发送消息
    async sendMessage() {
        const messageText = this.inputElement.value.trim();
        if (!messageText || this.isWaitingResponse) return;

        // 添加用户消息
        this.addMessage({
            role: 'user',
            content: messageText,
            timestamp: Date.now()
        });

        // 清空输入框
        this.inputElement.value = '';
        this.adjustInputHeight();

        // 发送到AI
        this.isWaitingResponse = true;
        this.updateStatus('AI思考中...');
        this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            // 调用AI API
            const response = await this.callAI(messageText);

            // 添加AI回复
            this.addMessage({
                role: 'assistant',
                content: response.content,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('发送消息失败:', error);
            this.addMessage({
                role: 'system',
                content: `发送失败: ${error.message}`,
                timestamp: Date.now(),
                isError: true
            });
        } finally {
            this.isWaitingResponse = false;
            this.updateStatus('就绪');
            this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    // 调用AI API
    async callAI(message) {
        // 获取配置
        const config = window.appConfig ? window.appConfig.getConfig() : this.getDefaultConfig();
        const model = this.modelSelect.value;
        const temperature = parseFloat(this.temperatureSlider.value);
        const systemPrompt = this.getSelectedPrompt();

        // 构建消息历史
        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.messages
                .filter(msg => msg.role !== 'system' || !msg.isError)
                .slice(-10) // 保留最近10条消息
                .map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: message }
        ];

        const requestBody = {
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: 2048,
            stream: false
        };

        console.log('发送API请求:', { url: config.url, model, temperature });

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorData}`);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API响应格式错误');
        }

        return {
            content: data.choices[0].message.content,
            usage: data.usage
        };
    }

    // 获取默认配置
    getDefaultConfig() {
        return {
            url: 'https://api.openai.com/v1/chat/completions',
            apiKey: 'your-api-key', // 需要用户配置
            model: 'gpt-3.5-turbo'
        };
    }

    // 获取选中的提示词
    getSelectedPrompt() {
        const selected = this.promptSelect.value;
        if (selected === 'custom') {
            return this.customPrompt.value || '你是一个有用的AI助手。';
        }
        return this.getPresetPrompt(selected);
    }

    // 获取预设提示词
    getPresetPrompt(type) {
        const prompts = {
            'default': '你是一个有用的AI助手，请友好、准确地回答用户的问题。',
            'coder': '你是一个专业的编程助手，擅长各种编程语言和技术问题。请提供清晰、准确的代码建议和解决方案。',
            'writer': '你是一个专业的写作助手，擅长各种文体的写作，包括创意写作、技术文档、商务写作等。请帮助用户改进文本质量。',
            'analyst': '你是一个专业的数据分析师，擅长数据分析、统计学和机器学习。请提供准确的数据洞察和分析建议。',
            'translator': '你是一个专业的翻译助手，能够在多种语言之间准确翻译，并保持原文的语调和风格。'
        };
        return prompts[type] || prompts['default'];
    }

    // 更新Agent配置
    updateAgentConfig(key, value) {
        // 这里可以保存配置到本地存储或发送到Agent管理器
        console.log(`更新配置: ${key} = ${value}`);
    }

    // 添加消息到对话
    addMessage(message) {
        this.messages.push(message);

        const messageElement = document.createElement('div');
        messageElement.className = `conv-message conv-message-${message.role}`;

        const isUser = message.role === 'user';
        const isError = message.isError || false;

        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-${isUser ? 'user' : (isError ? 'exclamation-triangle' : 'robot')}"></i>
            </div>
            <div class="message-content">
                <div class="message-text ${isError ? 'error' : ''}">${message.content}</div>
                <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
            </div>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // 更新消息计数
        this.messageCountElement.textContent = this.messages.length;
    }

    // 切换语音输入
    async toggleVoiceInput() {
        if (this.isRecording) {
            await this.stopVoiceInput();
        } else {
            await this.startVoiceInput();
        }
    }

    // 开始语音输入
    async startVoiceInput() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.processVoiceInput(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            this.voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            this.voiceButton.classList.add('recording');
            this.updateStatus('录音中...');

        } catch (error) {
            console.error('无法访问麦克风:', error);
            Utils.showNotification('无法访问麦克风，请检查权限设置', 'error');
        }
    }

    // 停止语音输入
    async stopVoiceInput() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        this.isRecording = false;
        this.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        this.voiceButton.classList.remove('recording');
        this.updateStatus('处理语音...');
    }

    // 处理语音输入
    async processVoiceInput(audioBlob) {
        try {
            // 这里需要集成语音转文本API
            // 暂时模拟处理
            this.updateStatus('转换语音到文本...');

            // 模拟延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 模拟结果（实际需要调用语音转文本API）
            const transcribedText = '这是语音转换的文本示例';

            this.inputElement.value = transcribedText;
            this.adjustInputHeight();
            this.updateStatus('就绪');

            Utils.showNotification('语音转换完成', 'success');

        } catch (error) {
            console.error('语音处理失败:', error);
            this.updateStatus('语音处理失败');
            Utils.showNotification('语音处理失败: ' + error.message, 'error');
        }
    }

    // 导出对话
    exportConversation() {
        const conversationData = {
            id: this.id,
            title: this.title,
            agentId: this.agentId,
            messages: this.messages,
            createdAt: Date.now(),
            exportedAt: Date.now()
        };

        const dataStr = JSON.stringify(conversationData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `conversation_${this.id}_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();

        Utils.showNotification('对话已导出', 'success');
    }

    // 处理文件上传
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        this.updateStatus('处理文件中...');

        for (const file of files) {
            try {
                const content = await this.readFile(file);

                // 添加文件消息
                this.addMessage({
                    role: 'user',
                    content: `📎 上传文件: ${file.name}\n类型: ${file.type}\n大小: ${this.formatFileSize(file.size)}`,
                    timestamp: Date.now(),
                    isFile: true,
                    fileData: {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content: content
                    }
                });

                // 如果是文本文件，自动分析
                if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                    await this.analyzeTextFile(file.name, content);
                }

            } catch (error) {
                console.error('文件处理失败:', error);
                this.addMessage({
                    role: 'system',
                    content: `文件 ${file.name} 处理失败: ${error.message}`,
                    timestamp: Date.now(),
                    isError: true
                });
            }
        }

        this.updateStatus('就绪');
        // 清空文件输入
        event.target.value = '';
    }

    // 读取文件内容
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                if (file.type.startsWith('image/')) {
                    resolve(e.target.result); // base64 for images
                } else {
                    resolve(e.target.result); // text content
                }
            };

            reader.onerror = () => reject(new Error('文件读取失败'));

            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    // 分析文本文件
    async analyzeTextFile(fileName, content) {
        const analysisPrompt = `请分析以下文件内容，提供简要总结：\n\n文件名: ${fileName}\n内容:\n${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}`;

        try {
            const response = await this.callAI(analysisPrompt);
            this.addMessage({
                role: 'assistant',
                content: response.content,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('文件分析失败:', error);
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 切换设置面板
    toggleSettings() {
        const panel = this.settingsPanel;
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            this.settingsButton.classList.add('active');
        } else {
            panel.style.display = 'none';
            this.settingsButton.classList.remove('active');
        }
    }

    // 切换节点生成
    toggleNode() {
        if (!this.nodeCreated) {
            this.createWorkflowNode();
            this.nodeButton.innerHTML = '<i class="fas fa-minus-circle"></i>';
            this.nodeButton.title = '移除节点';
            this.nodeCreated = true;
        } else {
            this.removeWorkflowNode();
            this.nodeButton.innerHTML = '<i class="fas fa-plus-circle"></i>';
            this.nodeButton.title = '生成节点';
            this.nodeCreated = false;
        }
    }

    // 创建工作流节点
    createWorkflowNode() {
        if (!window.workflowManager) {
            Utils.showNotification('工作流管理器未初始化', 'error');
            return;
        }

        try {
            // 创建AI对话节点
            const node = window.workflowManager.createNode('ai-chat-window', {
                x: 300,
                y: 200,
                config: {
                    windowId: this.id,
                    title: this.title,
                    model: this.modelSelect.value,
                    prompt: this.getSelectedPrompt(),
                    temperature: parseFloat(this.temperatureSlider.value)
                }
            });

            this.linkedNode = node;

            // 监听节点输入
            this.setupNodeConnection();

            Utils.showNotification('已生成对话节点', 'success');
            console.log('创建对话节点:', node.id);

        } catch (error) {
            console.error('创建节点失败:', error);
            Utils.showNotification('创建节点失败: ' + error.message, 'error');
        }
    }

    // 移除工作流节点
    removeWorkflowNode() {
        if (this.linkedNode && window.workflowManager) {
            try {
                window.workflowManager.deleteNode(this.linkedNode.id);
                this.linkedNode = null;
                Utils.showNotification('已移除对话节点', 'success');
            } catch (error) {
                console.error('移除节点失败:', error);
                Utils.showNotification('移除节点失败: ' + error.message, 'error');
            }
        }
    }

    // 设置节点连接
    setupNodeConnection() {
        if (!this.linkedNode) return;

        // 监听节点输入变化
        const checkNodeInput = () => {
            if (this.linkedNode && this.linkedNode.inputs && this.linkedNode.inputs.prompt) {
                const inputText = this.linkedNode.inputs.prompt;
                if (inputText && inputText !== this.lastNodeInput) {
                    this.lastNodeInput = inputText;
                    this.handleNodeInput(inputText);
                }
            }
        };

        // 定期检查节点输入
        this.nodeInputInterval = setInterval(checkNodeInput, 1000);
    }

    // 处理节点输入
    async handleNodeInput(inputText) {
        // 自动发送节点输入到对话
        this.inputElement.value = inputText;
        await this.sendMessage();

        // 将最后的AI回复输出到节点
        if (this.messages.length > 0) {
            const lastMessage = this.messages[this.messages.length - 1];
            if (lastMessage.role === 'assistant') {
                this.outputToNode(lastMessage.content);
            }
        }
    }

    // 输出到节点
    outputToNode(content) {
        if (this.linkedNode) {
            this.linkedNode.outputs = { response: content };

            // 如果有连接的下游节点，触发执行
            if (window.workflowManager && window.workflowManager.getNextNodes) {
                const nextNodes = window.workflowManager.getNextNodes(this.linkedNode.id);
                nextNodes.forEach(node => {
                    // 触发下游节点更新
                    if (window.workflowExecutor) {
                        console.log('触发下游节点:', node.id);
                    }
                });
            }
        }
    }

    // 调整输入框高度
    adjustInputHeight() {
        this.inputElement.style.height = 'auto';
        this.inputElement.style.height = Math.min(this.inputElement.scrollHeight, 120) + 'px';
    }

    // 更新状态
    updateStatus(status) {
        this.statusElement.textContent = status;
    }

    // 设置Agent
    setAgent(agentId) {
        this.agentId = agentId;
    }

    // 清空对话
    clearConversation() {
        this.messages = [];
        this.messagesContainer.innerHTML = `
            <div class="conv-welcome-message">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">
                        对话已清空，有什么可以帮助您的吗？
                    </div>
                    <div class="message-time">
                        ${new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>
        `;
        this.messageCountElement.textContent = '0';
    }
}

// 对话窗口管理器
class ConversationWindowManager {
    constructor() {
        this.windows = new Map();
        this.activeWindowId = null;

        this.initializeUI();
    }

    // 初始化UI
    initializeUI() {
        // 添加对话窗口按钮到工具栏
        this.addConversationButton();
    }

    // 添加对话窗口按钮
    addConversationButton() {
        const toolbar = document.querySelector('.toolbar-right');
        if (toolbar) {
            const chatButton = document.createElement('button');
            chatButton.className = 'btn btn-info';
            chatButton.id = 'openChatBtn';
            chatButton.title = '打开AI对话窗口';
            chatButton.innerHTML = '<i class="fas fa-comments"></i> 对话';

            chatButton.addEventListener('click', () => {
                this.createConversationWindow();
            });

            toolbar.insertBefore(chatButton, toolbar.firstChild);
        }
    }

    // 创建对话窗口
    createConversationWindow(config = {}) {
        const windowId = config.id || Utils.generateId('conv_');

        if (this.windows.has(windowId)) {
            this.windows.get(windowId).show();
            return this.windows.get(windowId);
        }

        const window = new ConversationWindow({
            id: windowId,
            title: config.title || `AI对话 ${this.windows.size + 1}`,
            position: config.position || this.getNextWindowPosition(),
            ...config
        });

        this.windows.set(windowId, window);
        this.activeWindowId = windowId;

        window.show();
        return window;
    }

    // 获取下一个窗口位置
    getNextWindowPosition() {
        const offset = this.windows.size * 30;
        return {
            x: 100 + offset,
            y: 100 + offset
        };
    }

    // 关闭对话窗口
    closeWindow(windowId) {
        const window = this.windows.get(windowId);
        if (window) {
            window.destroy();
            this.windows.delete(windowId);

            if (this.activeWindowId === windowId) {
                this.activeWindowId = null;
            }
        }
    }

    // 获取活动窗口
    getActiveWindow() {
        return this.activeWindowId ? this.windows.get(this.activeWindowId) : null;
    }

    // 获取所有窗口
    getAllWindows() {
        return Array.from(this.windows.values());
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.ConversationWindow = ConversationWindow;
    window.ConversationWindowManager = ConversationWindowManager;
}
