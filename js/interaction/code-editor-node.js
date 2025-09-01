// 代码编辑器节点 - 工作流集成
class CodeEditorNode extends InteractionNode {
    constructor(data = {}) {
        super('code-editor', data);
        this.editorWindow = null;
        this.editorId = data.config?.editorId || null;
        this.language = data.config?.language || 'javascript';
        this.autoRun = data.config?.autoRun || false;
        this.outputFormat = data.config?.outputFormat || 'text';
    }

    getDefaultConfig() {
        return {
            editorId: null,
            language: 'javascript',
            title: '代码编辑器',
            autoRun: false,
            outputFormat: 'text', // text, json, html
            codeTemplate: '',
            showTerminal: true,
            enableAI: true,
            executionTimeout: 30000,
            inputMode: 'manual', // manual, stream
            outputMode: 'result' // result, all, output
        };
    }

    getInputs() {
        return {
            code: { type: 'string', label: '代码输入', required: false },
            data: { type: 'any', label: '数据输入', required: false },
            command: { type: 'string', label: '执行命令', required: false }
        };
    }

    getOutputs() {
        return {
            result: { type: 'any', label: '执行结果' },
            output: { type: 'string', label: '控制台输出' },
            error: { type: 'string', label: '错误信息' },
            code: { type: 'string', label: '当前代码' }
        };
    }

    getNodeInfo() {
        return {
            title: this.config.title || '代码编辑器',
            category: '交互',
            description: '集成代码编辑器，支持多语言编程和AI辅助',
            color: '#FF6B6B',
            inputs: Object.keys(this.getInputs()),
            outputs: Object.keys(this.getOutputs())
        };
    }

    getPropertyConfig() {
        return [
            {
                key: 'description',
                type: 'info',
                label: '模式说明',
                value: '手动模式：代码输入到编辑器等待用户操作；流处理模式：自动执行输入的代码'
            },
            {
                key: 'title',
                type: 'text',
                label: '窗口标题',
                value: this.config.title || '代码编辑器'
            },
            {
                key: 'language',
                type: 'select',
                label: '编程语言',
                value: this.config.language || 'javascript',
                options: [
                    { value: 'javascript', label: 'JavaScript' },
                    { value: 'python', label: 'Python' },
                    { value: 'html', label: 'HTML' },
                    { value: 'css', label: 'CSS' },
                    { value: 'typescript', label: 'TypeScript' },
                    { value: 'json', label: 'JSON' },
                    { value: 'markdown', label: 'Markdown' }
                ]
            },
            {
                key: 'inputMode',
                type: 'select',
                label: '输入模式',
                value: this.config.inputMode || 'manual',
                options: [
                    { value: 'manual', label: '手动模式（代码输入到编辑器）' },
                    { value: 'stream', label: '流处理模式（自动执行代码）' }
                ]
            },
            {
                key: 'outputMode',
                type: 'select',
                label: '输出模式',
                value: this.config.outputMode || 'result',
                options: [
                    { value: 'result', label: '仅结果' },
                    { value: 'all', label: '完整输出' },
                    { value: 'output', label: '仅控制台输出' }
                ]
            },
            {
                key: 'autoRun',
                type: 'checkbox',
                label: '自动执行代码',
                value: this.config.autoRun !== false
            },
            {
                key: 'showTerminal',
                type: 'checkbox',
                label: '显示终端',
                value: this.config.showTerminal !== false
            },
            {
                key: 'enableAI',
                type: 'checkbox',
                label: '启用AI助手',
                value: this.config.enableAI !== false
            },
            {
                key: 'codeTemplate',
                type: 'textarea',
                label: '代码模板',
                value: this.config.codeTemplate || '',
                rows: 5,
                placeholder: '输入初始代码模板...'
            },
            {
                key: 'executionTimeout',
                type: 'number',
                label: '执行超时(ms)',
                value: this.config.executionTimeout || 30000,
                min: 1000,
                max: 300000
            }
        ];
    }

    // 连接到编辑器窗口
    connectToEditor() {
        if (this.editorId && window.codeEditorManager) {
            this.editorWindow = window.codeEditorManager.getWindow(this.editorId);

            if (this.editorWindow) {
                // 设置节点引用
                this.editorWindow.linkedNode = this;

                // 同步配置
                this.syncConfigToEditor();

                return true;
            }
        }
        return false;
    }

    // 同步配置到编辑器
    syncConfigToEditor() {
        if (!this.editorWindow) return;

        // 更新窗口标题
        if (this.config.title) {
            this.editorWindow.title = this.config.title;
            const titleElement = this.editorWindow.windowElement.querySelector('.title-text');
            if (titleElement) {
                titleElement.textContent = this.config.title;
            }
        }

        // 设置代码模板
        if (this.config.codeTemplate && this.editorWindow.editor) {
            this.editorWindow.setCode(this.config.codeTemplate);
        }
    }

    // 处理节点逻辑
    async processNode() {
        const inputs = this.getResolvedInputs();
        console.log(`[代码编辑器节点 ${this.id}] 接收到输入:`, inputs);

        // 尝试连接到编辑器窗口
        if (!this.editorWindow) {
            this.connectToEditor();
        }

        // 如果没有编辑器窗口，创建一个新的
        if (!this.editorWindow) {
            this.editorWindow = await this.createEditorWindow();
        }

        const inputMode = this.config.inputMode || 'manual';
        const outputMode = this.config.outputMode || 'result';

        try {
            // 处理代码输入
            if (inputs.code) {
                await this.handleCodeInput(inputs.code, inputMode);
            }

            // 处理数据输入
            if (inputs.data !== undefined && inputs.data !== null) {
                await this.handleDataInput(inputs.data);
            }

            // 处理命令输入
            if (inputs.command) {
                await this.handleCommandInput(inputs.command);
            }

            // 根据输出模式返回结果
            return this.generateOutput(outputMode);

        } catch (error) {
            console.error(`[代码编辑器节点 ${this.id}] 处理失败:`, error);
            throw new Error(`代码编辑器节点处理失败: ${error.message}`);
        }
    }

    // 创建编辑器窗口
    async createEditorWindow() {
        if (!window.CodeEditorWindow) {
            throw new Error('CodeEditorWindow 类未加载');
        }

        const editorWindow = new CodeEditorWindow({
            id: Utils.generateId('editor_'),
            title: this.config.title || '代码编辑器',
            language: this.config.language || 'javascript',
            position: { x: 150, y: 150 }
        });

        // 等待编辑器初始化完成
        await new Promise(resolve => {
            const checkInit = () => {
                if (editorWindow.editor && editorWindow.terminal) {
                    resolve();
                } else {
                    setTimeout(checkInit, 100);
                }
            };
            checkInit();
        });

        // 设置节点引用
        editorWindow.linkedNode = this;
        this.editorId = editorWindow.id;

        // 显示窗口
        editorWindow.show();

        console.log(`[代码编辑器节点 ${this.id}] 创建了新的编辑器窗口:`, editorWindow.id);

        return editorWindow;
    }

    // 处理代码输入
    async handleCodeInput(code, inputMode) {
        if (!this.editorWindow) return;

        if (inputMode === 'manual') {
            // 手动模式：将代码设置到编辑器，等待用户操作
            console.log(`[代码编辑器节点 ${this.id}] 手动模式，代码已设置到编辑器`);
            this.editorWindow.setCode(code);

            // 聚焦到编辑器
            if (this.editorWindow.editor) {
                this.editorWindow.editor.focus();
            }

        } else if (inputMode === 'stream') {
            // 流处理模式：自动执行代码
            console.log(`[代码编辑器节点 ${this.id}] 流处理模式，自动执行代码`);
            this.editorWindow.setCode(code);

            // 如果启用自动运行，执行代码
            if (this.config.autoRun) {
                await this.editorWindow.runCode();
            }
        }
    }

    // 处理数据输入
    async handleDataInput(data) {
        if (!this.editorWindow) return;

        // 将数据注入到执行环境中
        const dataVar = `__input_data__ = ${JSON.stringify(data)};`;

        if (this.config.language === 'javascript') {
            // JavaScript: 通过worker传递数据
            if (this.editorWindow.executionEngine && this.editorWindow.executionEngine.jsWorker) {
                this.editorWindow.executionEngine.jsWorker.postMessage({
                    command: dataVar
                });
            }
        } else if (this.config.language === 'python') {
            // Python: 设置变量
            if (this.editorWindow.executionEngine && this.editorWindow.executionEngine.pythonEnv) {
                this.editorWindow.executionEngine.pythonEnv.runPython(`
import json
__input_data__ = json.loads('${JSON.stringify(data)}')
                `);
            }
        }

        console.log(`[代码编辑器节点 ${this.id}] 数据已注入:`, data);
    }

    // 处理命令输入
    async handleCommandInput(command) {
        if (!this.editorWindow) return;

        // 执行终端命令
        if (this.editorWindow.executionEngine) {
            await this.editorWindow.executionEngine.executeCommand(command);
        }

        console.log(`[代码编辑器节点 ${this.id}] 命令已执行:`, command);
    }

    // 生成输出
    generateOutput(outputMode) {
        if (!this.editorWindow) {
            return {
                result: null,
                output: '',
                error: '',
                code: ''
            };
        }

        const currentCode = this.editorWindow.getCode();
        const executionEngine = this.editorWindow.executionEngine;

        let result = null;
        let output = '';
        let error = '';

        // 获取执行结果
        if (executionEngine && executionEngine.executionHistory.length > 0) {
            const lastExecution = executionEngine.executionHistory[executionEngine.executionHistory.length - 1];

            if (lastExecution.status === 'error') {
                error = lastExecution.error || '';
            } else if (lastExecution.status === 'completed') {
                // 尝试获取结果变量
                if (this.config.language === 'javascript') {
                    // JavaScript结果通过console.log输出
                    output = this.getConsoleOutput();
                } else if (this.config.language === 'python') {
                    // Python结果
                    output = this.getPythonOutput();
                    result = this.getPythonResult();
                }
            }
        }

        // 根据输出模式返回相应数据
        const baseOutput = {
            result: result,
            output: output,
            error: error,
            code: currentCode
        };

        if (outputMode === 'result') {
            return { result: result || output };
        } else if (outputMode === 'output') {
            return { output: output };
        } else {
            return baseOutput;
        }
    }

    // 获取控制台输出
    getConsoleOutput() {
        // 从终端获取最近的输出
        if (this.editorWindow.terminal) {
            // 这里需要实现从xterm.js获取输出的逻辑
            // 暂时返回空字符串
            return '';
        }
        return '';
    }

    // 获取Python输出
    getPythonOutput() {
        if (this.editorWindow.executionEngine && this.editorWindow.executionEngine.pythonEnv) {
            try {
                // 获取Python的stdout
                return this.editorWindow.executionEngine.pythonEnv.runPython('stdout_buffer.getvalue()') || '';
            } catch (e) {
                return '';
            }
        }
        return '';
    }

    // 获取Python结果
    getPythonResult() {
        if (this.editorWindow.executionEngine && this.editorWindow.executionEngine.pythonEnv) {
            try {
                // 尝试获取结果变量
                const result = this.editorWindow.executionEngine.pythonEnv.runPython('globals().get("__result__", None)');
                return result !== 'None' ? result : null;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    // 设置代码
    setCode(code) {
        if (this.editorWindow) {
            this.editorWindow.setCode(code);
        }
    }

    // 获取代码
    getCode() {
        return this.editorWindow ? this.editorWindow.getCode() : '';
    }

    // 执行代码
    async executeCode() {
        if (this.editorWindow) {
            await this.editorWindow.runCode();
        }
    }

    // 发送AI消息
    async sendAIMessage(message) {
        if (this.editorWindow && this.editorWindow.aiAssistant) {
            return await this.editorWindow.aiAssistant.processMessage(message, this.getCode());
        }
        throw new Error('AI助手不可用');
    }

    // 更新配置
    updateConfig(newConfig) {
        super.updateConfig(newConfig);

        // 同步配置到编辑器
        if (this.editorWindow) {
            this.syncConfigToEditor();
        }
    }

    // 节点销毁时清理资源
    destroy() {
        if (this.editorWindow) {
            this.editorWindow.linkedNode = null;
        }
        super.destroy && super.destroy();
    }

    // 清理资源（工作流管理器调用）
    cleanup() {
        console.log(`[代码编辑器节点 ${this.id}] 清理资源`);

        // 关闭编辑器窗口
        if (this.editorWindow) {
            try {
                this.editorWindow.linkedNode = null;
                this.editorWindow.close();
                this.editorWindow = null;
            } catch (error) {
                console.error('关闭编辑器窗口失败:', error);
            }
        }

        // 调用父类清理
        if (super.cleanup) {
            super.cleanup();
        }
    }

    // 双击事件处理
    onDoubleClick(e) {
        e.stopPropagation();
        console.log('代码编辑器节点双击:', this.id);

        // 打开或聚焦编辑器窗口
        this.openEditor();
    }

    // 打开编辑器窗口
    async openEditor() {
        console.log('代码编辑器节点：开始打开编辑器窗口');

        try {
            // 如果已有编辑器窗口，聚焦它
            if (this.editorWindow) {
                console.log('编辑器窗口已存在，聚焦窗口');
                this.editorWindow.show();
                if (this.editorWindow.focus) {
                    this.editorWindow.focus();
                }
                return;
            }

            // 尝试连接到现有编辑器
            if (this.connectToEditor()) {
                console.log('连接到现有编辑器成功');
                this.editorWindow.show();
                if (this.editorWindow.focus) {
                    this.editorWindow.focus();
                }
                return;
            }

            // 创建新的编辑器窗口
            console.log('创建新的编辑器窗口');
            this.editorWindow = await this.createEditorWindow();
            Utils.showNotification('代码编辑器已打开', 'success');

        } catch (error) {
            console.error('打开编辑器失败:', error);
            Utils.showNotification('打开编辑器失败: ' + error.message, 'error');
        }
    }
}

// 代码编辑器管理器
class CodeEditorManager {
    constructor() {
        this.windows = new Map();
        this.activeWindow = null;

        this.initializeUI();
    }

    // 初始化UI
    initializeUI() {
        // 在工具栏添加代码编辑器按钮
        this.addCodeEditorButton();
    }

    // 添加代码编辑器按钮
    addCodeEditorButton() {
        const toolbar = document.querySelector('.toolbar-center');
        if (!toolbar) return;

        const button = document.createElement('button');
        button.className = 'btn btn-primary';
        button.innerHTML = '<i class="fas fa-code"></i> 代码编辑器';
        button.title = '打开代码编辑器';

        button.addEventListener('click', () => {
            this.createCodeEditor();
        });

        toolbar.appendChild(button);
    }

    // 创建代码编辑器
    async createCodeEditor(config = {}) {
        const defaultConfig = {
            id: Utils.generateId('editor_'),
            title: '代码编辑器',
            language: 'javascript',
            position: this.getNextWindowPosition()
        };

        const finalConfig = { ...defaultConfig, ...config };

        try {
            const editorWindow = new CodeEditorWindow(finalConfig);
            await this.waitForEditor(editorWindow);

            this.windows.set(editorWindow.id, editorWindow);
            this.activeWindow = editorWindow;

            editorWindow.show();

            Utils.showNotification('代码编辑器已创建', 'success');
            console.log('创建代码编辑器:', editorWindow.id);

            return editorWindow;

        } catch (error) {
            Utils.showNotification('创建代码编辑器失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 等待编辑器初始化完成
    async waitForEditor(editorWindow) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn('编辑器初始化超时，但继续执行...');
                resolve(); // 改为resolve而不是reject，允许部分功能
            }, 15000); // 增加到15秒

            const checkInit = () => {
                // 放宽初始化要求，只要编辑器存在就认为可以使用
                if (editorWindow.editor || editorWindow.editorContainer) {
                    clearTimeout(timeout);
                    console.log('编辑器基本组件已初始化');
                    resolve();
                } else {
                    setTimeout(checkInit, 200);
                }
            };

            checkInit();
        });
    }

    // 获取下一个窗口位置
    getNextWindowPosition() {
        const offset = this.windows.size * 30;
        return {
            x: 100 + offset,
            y: 100 + offset
        };
    }

    // 关闭编辑器窗口
    closeWindow(windowId) {
        const window = this.windows.get(windowId);
        if (window) {
            window.close();
            this.windows.delete(windowId);

            if (this.activeWindow === window) {
                this.activeWindow = this.windows.size > 0 ?
                    Array.from(this.windows.values())[0] : null;
            }
        }
    }

    // 获取窗口
    getWindow(windowId) {
        return this.windows.get(windowId);
    }

    // 获取活动窗口
    getActiveWindow() {
        return this.activeWindow;
    }

    // 获取所有窗口
    getAllWindows() {
        return Array.from(this.windows.values());
    }

    // 切换语言
    async switchLanguage(windowId, language) {
        const window = this.windows.get(windowId);
        if (window) {
            window.language = language;

            // 重新初始化执行引擎
            if (window.executionEngine) {
                window.executionEngine.destroy();
                window.executionEngine = new CodeExecutionEngine(language);
                await window.executionEngine.initialize();
            }

            // 更新Monaco编辑器语言
            if (window.editor) {
                monaco.editor.setModelLanguage(window.editor.getModel(), language);
            }

            Utils.showNotification(`语言已切换为 ${language.toUpperCase()}`, 'success');
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.CodeEditorNode = CodeEditorNode;
    window.CodeEditorManager = CodeEditorManager;

    // 初始化代码编辑器管理器
    window.addEventListener('DOMContentLoaded', () => {
        if (!window.codeEditorManager) {
            window.codeEditorManager = new CodeEditorManager();
        }
    });
}
