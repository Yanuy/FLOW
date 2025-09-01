// AI代码助手 - 集成到代码编辑器的智能助手
class AICodeAssistant {
    constructor(codeEditor) {
        this.codeEditor = codeEditor;
        this.apiClient = null;
        this.conversationHistory = [];
        this.isProcessing = false;

        // 代码助手的专业提示词
        this.systemPrompt = this.generateSystemPrompt();

        this.initialize();
    }

    // 初始化AI助手
    initialize() {
        // 获取API客户端
        this.apiClient = window.simpleAPIClient || window.apiClient;

        if (!this.apiClient) {
            console.warn('API客户端未初始化，AI代码助手功能将受限');
        }
    }

    // 生成系统提示词
    generateSystemPrompt() {
        const language = this.codeEditor.language;

        return `你是一个专业的${language.toUpperCase()}代码助手，具有以下能力：

🎯 **核心职责**：
- 生成高质量、可运行的${language}代码
- 解释代码功能和原理
- 发现并修复代码错误
- 优化代码性能和结构
- 添加详细的代码注释

💡 **专业特长**：
- ${this.getLanguageSpecificSkills(language)}
- 遵循最佳编程实践
- 提供多种解决方案
- 考虑代码的可读性和维护性

📋 **回答格式**：
- 优先提供完整可执行的代码
- 使用\`\`\`${language}代码块格式
- 简洁明了的解释
- 必要时提供使用示例

🔧 **当前环境**：
- 语言：${language.toUpperCase()}
- 执行环境：浏览器${language === 'python' ? ' + Pyodide' : ''}
- 支持的功能：${this.getSupportedFeatures(language)}

请始终关注代码的实用性和可执行性。用户可能会直接运行你提供的代码，所以请确保代码的正确性。`;
    }

    // 获取语言特定技能
    getLanguageSpecificSkills(language) {
        const skills = {
            javascript: `
- ES6+现代JavaScript语法
- DOM操作和事件处理
- 异步编程（Promise、async/await）
- 模块化开发
- Web API使用
- 数据结构与算法`,
            python: `
- Python标准库和第三方库
- 数据科学（NumPy、Pandas、Matplotlib）
- 面向对象编程
- 函数式编程
- 文件处理和数据分析
- 算法实现和优化`,
            html: `
- 语义化HTML5标签
- 表单设计和验证
- 响应式布局
- 无障碍设计
- SEO优化
- 现代HTML最佳实践`
        };

        return skills[language] || '通用编程技能';
    }

    // 获取支持的功能
    getSupportedFeatures(language) {
        const features = {
            javascript: 'console输出、Web API、异步操作、JSON处理',
            python: 'print输出、数据科学库、图形绘制、文件操作',
            html: 'DOM渲染、CSS样式、JavaScript交互、表单处理'
        };

        return features[language] || '基础代码执行';
    }

    // 处理用户消息
    async processMessage(userMessage, currentCode = '') {
        if (this.isProcessing) {
            throw new Error('AI助手正在处理中，请稍候');
        }

        if (!this.apiClient) {
            throw new Error('API客户端未配置，请检查设置');
        }

        this.isProcessing = true;

        try {
            // 构建上下文信息
            const context = this.buildContext(userMessage, currentCode);

            // 构建完整的对话消息
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...this.conversationHistory.slice(-10), // 保留最近10轮对话
                { role: 'user', content: context }
            ];

            // 调用AI API
            const response = await this.apiClient.chatCompletion(context, {
                model: 'gpt-4',
                temperature: 0.1, // 较低的temperature确保代码准确性
                maxTokens: 2048,
                messages: messages
            });

            // 添加到对话历史
            this.conversationHistory.push(
                { role: 'user', content: userMessage },
                { role: 'assistant', content: response.content }
            );

            // 检查是否包含代码，自动提供操作选项
            const codeBlocks = this.extractCodeBlocks(response.content);
            if (codeBlocks.length > 0) {
                return this.formatResponseWithActions(response.content, codeBlocks);
            }

            return response.content;

        } catch (error) {
            console.error('AI代码助手错误:', error);
            throw new Error(`AI请求失败: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    // 构建上下文信息
    buildContext(userMessage, currentCode) {
        let context = userMessage;

        // 如果有当前代码，包含到上下文中
        if (currentCode && currentCode.trim()) {
            const selectedCode = this.codeEditor.getSelectedCode();

            if (selectedCode && selectedCode !== currentCode) {
                context += `\n\n**选中的代码片段：**\n\`\`\`${this.codeEditor.language}\n${selectedCode}\n\`\`\``;
            } else {
                context += `\n\n**当前完整代码：**\n\`\`\`${this.codeEditor.language}\n${currentCode}\n\`\`\``;
            }
        }

        // 添加执行历史信息（如果有错误）
        const executionEngine = this.codeEditor.executionEngine;
        if (executionEngine && executionEngine.executionHistory.length > 0) {
            const lastExecution = executionEngine.executionHistory[executionEngine.executionHistory.length - 1];
            if (lastExecution.status === 'error') {
                context += `\n\n**最近的执行错误：**\n${lastExecution.error}`;
            }
        }

        // 添加语言特定上下文
        context += `\n\n**请注意：**\n- 目标语言：${this.codeEditor.language.toUpperCase()}\n- 需要可在浏览器环境中执行\n- 优先提供完整可运行的代码示例`;

        return context;
    }

    // 提取代码块
    extractCodeBlocks(content) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks = [];
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || this.codeEditor.language,
                code: match[2].trim(),
                fullMatch: match[0]
            });
        }

        return blocks;
    }

    // 格式化响应并添加操作按钮
    formatResponseWithActions(content, codeBlocks) {
        let formattedContent = content;

        // 为每个代码块添加操作按钮
        codeBlocks.forEach((block, index) => {
            const actionButtons = `
<div class="ai-code-actions" data-code-index="${index}">
    <button class="ai-action-btn" data-action="insert" title="插入到编辑器">
        <i class="fas fa-plus"></i> 插入
    </button>
    <button class="ai-action-btn" data-action="replace" title="替换当前代码">
        <i class="fas fa-sync"></i> 替换
    </button>
    <button class="ai-action-btn" data-action="run" title="直接运行">
        <i class="fas fa-play"></i> 运行
    </button>
    <button class="ai-action-btn" data-action="copy" title="复制代码">
        <i class="fas fa-copy"></i> 复制
    </button>
</div>`;

            formattedContent = formattedContent.replace(
                block.fullMatch,
                block.fullMatch + actionButtons
            );
        });

        // 绑定按钮事件
        setTimeout(() => this.bindCodeActionEvents(codeBlocks), 100);

        return formattedContent;
    }

    // 绑定代码操作按钮事件
    bindCodeActionEvents(codeBlocks) {
        const aiMessages = document.getElementById(`aiMessages-${this.codeEditor.id}`);
        if (!aiMessages) return;

        aiMessages.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.ai-action-btn');
            if (!actionBtn) return;

            const codeActions = actionBtn.closest('.ai-code-actions');
            const codeIndex = parseInt(codeActions.dataset.codeIndex);
            const action = actionBtn.dataset.action;
            const codeBlock = codeBlocks[codeIndex];

            if (!codeBlock) return;

            this.executeCodeAction(action, codeBlock);
        });
    }

    // 执行代码操作
    executeCodeAction(action, codeBlock) {
        const { code, language } = codeBlock;

        switch (action) {
            case 'insert':
                this.codeEditor.insertCode(code);
                Utils.showNotification('代码已插入到编辑器', 'success');
                break;

            case 'replace':
                this.codeEditor.setCode(code);
                Utils.showNotification('代码已替换', 'success');
                break;

            case 'run':
                this.codeEditor.setCode(code);
                setTimeout(() => {
                    this.codeEditor.runCode();
                }, 100);
                Utils.showNotification('代码已设置并开始运行', 'success');
                break;

            case 'copy':
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(() => {
                        Utils.showNotification('代码已复制到剪贴板', 'success');
                    });
                } else {
                    // 降级方案
                    const textArea = document.createElement('textarea');
                    textArea.value = code;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    Utils.showNotification('代码已复制到剪贴板', 'success');
                }
                break;
        }
    }

    // 预设的快速操作
    async generateCode(description) {
        const prompt = `请生成${this.codeEditor.language}代码来实现以下功能：\n\n${description}\n\n要求：\n- 代码完整可运行\n- 包含必要的注释\n- 遵循最佳实践`;

        return await this.processMessage(prompt);
    }

    async explainCode(code = null) {
        const targetCode = code || this.codeEditor.getSelectedCode() || this.codeEditor.getCode();

        if (!targetCode.trim()) {
            throw new Error('没有代码需要解释');
        }

        const prompt = `请详细解释以下${this.codeEditor.language}代码的功能、逻辑和实现原理：\n\n\`\`\`${this.codeEditor.language}\n${targetCode}\n\`\`\``;

        return await this.processMessage(prompt);
    }

    async fixCode(error = null) {
        const currentCode = this.codeEditor.getCode();

        if (!currentCode.trim()) {
            throw new Error('没有代码需要修复');
        }

        let prompt = `请帮我修复以下${this.codeEditor.language}代码中的错误：\n\n\`\`\`${this.codeEditor.language}\n${currentCode}\n\`\`\``;

        if (error) {
            prompt += `\n\n**错误信息：**\n${error}`;
        }

        prompt += `\n\n请提供修复后的完整代码，并解释修复的原因。`;

        return await this.processMessage(prompt);
    }

    async optimizeCode() {
        const currentCode = this.codeEditor.getCode();

        if (!currentCode.trim()) {
            throw new Error('没有代码需要优化');
        }

        const prompt = `请优化以下${this.codeEditor.language}代码的性能、可读性和结构：\n\n\`\`\`${this.codeEditor.language}\n${currentCode}\n\`\`\`\n\n要求：\n- 保持功能不变\n- 提高代码质量\n- 添加注释说明\n- 解释优化点`;

        return await this.processMessage(prompt);
    }

    async addComments() {
        const currentCode = this.codeEditor.getCode();

        if (!currentCode.trim()) {
            throw new Error('没有代码需要添加注释');
        }

        const prompt = `请为以下${this.codeEditor.language}代码添加详细的注释：\n\n\`\`\`${this.codeEditor.language}\n${currentCode}\n\`\`\`\n\n要求：\n- 保持原有代码不变\n- 添加清晰的注释\n- 解释复杂逻辑\n- 注释格式规范`;

        return await this.processMessage(prompt);
    }

    // 快速命令处理
    async processQuickCommand(command) {
        const commands = {
            'explain': () => this.explainCode(),
            'fix': () => this.fixCode(),
            'optimize': () => this.optimizeCode(),
            'comment': () => this.addComments(),
            'test': () => this.generateTests(),
            'doc': () => this.generateDocumentation()
        };

        const handler = commands[command.toLowerCase()];
        if (handler) {
            return await handler();
        } else {
            throw new Error(`未知的快速命令: ${command}`);
        }
    }

    // 生成测试代码
    async generateTests() {
        const currentCode = this.codeEditor.getCode();

        if (!currentCode.trim()) {
            throw new Error('没有代码需要生成测试');
        }

        const prompt = `请为以下${this.codeEditor.language}代码生成测试用例：\n\n\`\`\`${this.codeEditor.language}\n${currentCode}\n\`\`\`\n\n要求：\n- 全面的测试覆盖\n- 包含正常和异常情况\n- 使用适当的测试框架\n- 清晰的测试说明`;

        return await this.processMessage(prompt);
    }

    // 生成文档
    async generateDocumentation() {
        const currentCode = this.codeEditor.getCode();

        if (!currentCode.trim()) {
            throw new Error('没有代码需要生成文档');
        }

        const prompt = `请为以下${this.codeEditor.language}代码生成详细的文档：\n\n\`\`\`${this.codeEditor.language}\n${currentCode}\n\`\`\`\n\n要求：\n- API文档格式\n- 函数/类说明\n- 参数和返回值说明\n- 使用示例\n- 注意事项`;

        return await this.processMessage(prompt);
    }

    // 清空对话历史
    clearHistory() {
        this.conversationHistory = [];
        Utils.showNotification('AI对话历史已清空', 'success');
    }

    // 获取对话历史
    getHistory() {
        return this.conversationHistory;
    }

    // 导出对话历史
    exportHistory() {
        const historyData = {
            timestamp: Date.now(),
            language: this.codeEditor.language,
            conversations: this.conversationHistory
        };

        const dataStr = JSON.stringify(historyData, null, 2);
        Utils.downloadFile(dataStr, `ai-conversation-${Date.now()}.json`, 'application/json');
        Utils.showNotification('对话历史已导出', 'success');
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.AICodeAssistant = AICodeAssistant;
}
