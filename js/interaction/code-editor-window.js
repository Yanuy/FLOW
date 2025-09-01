// 交互式代码编辑器窗口 - SOTA代码编辑和执行环境
class CodeEditorWindow {
    constructor(config = {}) {
        this.id = config.id || Utils.generateId('code_');
        this.title = config.title || 'Code Editor';
        this.language = config.language || 'javascript';
        this.position = config.position || { x: 100, y: 100 };
        this.size = config.size || { width: 1000, height: 700 };

        // 编辑器相关
        this.editor = null;
        this.terminal = null;
        this.isVisible = false;
        this.isMinimized = false;

        // 执行环境
        this.executionEngine = null;
        this.isExecuting = false;
        this.currentSession = null;

        // AI助手
        this.aiAssistant = null;
        this.isAIMode = true; // 默认开启AI助手

        // 文件系统
        this.fileTree = new Map();
        this.currentFile = null;
        this.projectPath = '/workspace';

        // UI元素
        this.windowElement = null;
        this.editorContainer = null;
        this.terminalContainer = null;
        this.fileExplorer = null;
        this.statusBar = null;

        // 节点连接
        this.linkedNode = null;
        this.nodeCreated = false;

        // 调整大小相关
        this.sidebarWidth = 300;
        this.terminalHeight = 250;
        this.aiPanelHeight = 400; // 增加默认高度，接近文件浏览器高度

        // 回调函数
        this.onSave = null;
        this.onClose = null;

        this.initialize();

        // 添加全局错误处理
        this.setupGlobalErrorHandling();
    }

    // 初始化编辑器
    async initialize() {
        this.createWindow();
        await this.loadDependencies();
        await this.initializeEditor();
        await this.initializeTerminal();
        await this.initializeExecutionEngine();
        this.initializeFileSystem();
        this.initializeAIAssistant();
        this.bindEvents();

        console.log('Code Editor Window initialized:', this.id);
    }

    // 加载依赖库
    async loadDependencies() {
        try {
            // Monaco Editor - 使用全局单例避免重复加载
            if (!window.monaco && !window.monacoLoading) {
                window.monacoLoading = true;
                console.log('Loading Monaco Editor...');

                // 确保只有一个 Monaco 实例
                if (window.require && window.require.defined && window.require.defined('vs/editor/editor.main')) {
                    window.monaco = window.require('vs/editor/editor.main');
                    window.monacoLoading = false;
                    console.log('Monaco Editor already loaded');
                    return;
                }

                // 清理可能的冲突状态
                if (window.require && window.require.undef) {
                    try {
                        window.require.undef('vs/editor/editor.main');
                    } catch (e) {
                        console.warn('Failed to undefine monaco module:', e);
                    }
                }

                // 设置 Monaco 环境（避免重复设置）
                if (!window.MonacoEnvironment) {
                    window.MonacoEnvironment = {
                        getWorkerUrl: function (moduleId, label) {
                            // 在本地文件协议下禁用 Web Workers，使用主线程
                            if (window.location.protocol === 'file:') {
                                return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
                                    self.MonacoEnvironment = {
                                        baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/'
                                    };
                                `);
                            }

                            // 正常环境下使用 CDN Workers
                            if (label === 'json') {
                                return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/json/json.worker.js';
                            }
                            if (label === 'css' || label === 'scss' || label === 'less') {
                                return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/css/css.worker.js';
                            }
                            if (label === 'html' || label === 'handlebars' || label === 'razor') {
                                return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/html/html.worker.js';
                            }
                            if (label === 'typescript' || label === 'javascript') {
                                return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/typescript/ts.worker.js';
                            }
                            return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/editor/editor.worker.js';
                        }
                    };
                }

                // 加载 RequireJS
                if (!window.require) {
                    await this.loadScript('https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js');
                }

                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.warn('Monaco loading timeout, using fallback');
                        window.monacoLoading = false;
                        resolve();
                    }, 15000);

                    try {
                        require.config({
                            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' },
                            'vs/nls': {
                                availableLanguages: {
                                    '*': 'zh-cn'
                                }
                            }
                        });

                        require(['vs/editor/editor.main'], () => {
                            clearTimeout(timeout);
                            console.log('Monaco Editor loaded successfully');
                            window.monacoLoading = false;
                            resolve();
                        }, (err) => {
                            clearTimeout(timeout);
                            console.error('Monaco require error:', err);
                            window.monacoLoading = false;
                            resolve(); // 不抛出错误，使用fallback
                        });
                    } catch (error) {
                        clearTimeout(timeout);
                        console.error('Monaco loading error:', error);
                        window.monacoLoading = false;
                        resolve(); // 不抛出错误，使用fallback
                    }
                });
            } else if (window.monacoLoading) {
                // 等待加载完成
                let attempts = 0;
                while (window.monacoLoading && !window.monaco && attempts < 100) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
            }

            // Xterm.js - 避免重复加载
            if (!window.Terminal && !window.xtermLoading) {
                window.xtermLoading = true;
                console.log('Loading Xterm.js...');

                await this.loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js');
                await this.loadCSS('https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css');

                // 加载 xterm addon
                await this.loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js');

                window.xtermLoading = false;
                console.log('Xterm.js loaded successfully');
            } else if (window.xtermLoading) {
                // 等待加载完成
                while (window.xtermLoading && !window.Terminal) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Pyodide for Python - 按需加载
            if (this.language === 'python' && !window.pyodide && !window.pyodideLoading) {
                window.pyodideLoading = true;
                console.log('Loading Pyodide...');

                await this.loadScript('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');

                window.pyodideLoading = false;
                console.log('Pyodide loaded successfully');
            }

        } catch (error) {
            console.error('Error loading dependencies:', error);
            throw error;
        }
    }

    // 加载脚本
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`Script loaded: ${src}`);
                resolve();
            };
            script.onerror = (error) => {
                console.error(`Failed to load script: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    // 加载CSS
    loadCSS(href) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            const existingLink = document.querySelector(`link[href="${href}"]`);
            if (existingLink) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => {
                console.log(`CSS loaded: ${href}`);
                resolve();
            };
            link.onerror = (error) => {
                console.error(`Failed to load CSS: ${href}`, error);
                reject(new Error(`Failed to load CSS: ${href}`));
            };
            document.head.appendChild(link);
        });
    }

    // 创建窗口DOM结构
    createWindow() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'code-editor-window';
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
            <div class="code-window-header">
                <div class="code-window-title">
                    <i class="fas fa-code"></i>
                    <span class="title-text">${this.title}</span>
                    <span class="language-badge">${this.language.toUpperCase()}</span>
                </div>
                <div class="code-window-controls">
                    <button class="code-btn code-btn-ai" id="aiBtn-${this.id}" title="AI助手">
                        <i class="fas fa-robot"></i>
                    </button>
                    <button class="code-btn code-btn-run" id="runBtn-${this.id}" title="运行代码">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="code-btn code-btn-stop" id="stopBtn-${this.id}" title="停止执行">
                        <i class="fas fa-stop"></i>
                    </button>
                    <button class="code-btn code-btn-settings" id="settingsBtn-${this.id}" title="设置">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="code-btn code-btn-node" id="nodeBtn-${this.id}" title="生成节点">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    <button class="code-btn code-btn-minimize" title="最小化">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="code-btn code-btn-close" title="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="code-window-body" id="windowBody-${this.id}">
                <!-- 主要工作区 -->
                <div class="code-main-area">
                    <!-- 侧边栏 -->
                    <div class="code-sidebar" id="sidebar-${this.id}">
                        <!-- 文件浏览器 -->
                        <div class="sidebar-section">
                            <div class="sidebar-header">
                                <h4>文件浏览器</h4>
                                <div class="sidebar-actions">
                                    <button class="sidebar-btn" id="newFileBtn-${this.id}" title="新建文件">
                                        <i class="fas fa-file-plus"></i>
                                    </button>
                                    <button class="sidebar-btn" id="newFolderBtn-${this.id}" title="新建文件夹">
                                        <i class="fas fa-folder-plus"></i>
                                    </button>
                                    <button class="sidebar-btn" id="uploadBtn-${this.id}" title="上传文件">
                                        <i class="fas fa-upload"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="file-tree" id="fileTree-${this.id}">
                                <!-- 文件树将在这里渲染 -->
                            </div>
                        </div>

                        <!-- AI助手面板分隔条 -->
                        <div class="ai-panel-resizer" id="aiResizer-${this.id}" style="display: block;"></div>

                        <!-- AI助手面板 -->
                        <div class="sidebar-section ai-panel" id="aiPanel-${this.id}" style="display: block;">
                            <div class="sidebar-header">
                                <h4>AI代码助手</h4>
                                <button class="sidebar-btn" id="aiCloseBtn-${this.id}" title="关闭AI">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="ai-chat-area">
                                <div class="ai-messages" id="aiMessages-${this.id}">
                                    <div class="ai-welcome">
                                        <i class="fas fa-robot"></i>
                                        <p>我是AI代码助手，可以帮您：</p>
                                        <ul>
                                            <li>生成代码</li>
                                            <li>解释代码</li>
                                            <li>修复错误</li>
                                            <li>优化性能</li>
                                            <li>添加注释</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="ai-input-area">
                                    <textarea class="ai-input" id="aiInput-${this.id}" 
                                              placeholder="告诉我您需要什么代码..."></textarea>
                                    <button class="code-btn ai-send-btn" id="aiSendBtn-${this.id}">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 侧边栏调整大小拖拽条 -->
                        <div class="sidebar-resizer-vertical" id="sidebarResizer-${this.id}"></div>
                    </div>

                    <!-- 编辑器区域 -->
                    <div class="code-editor-area">
                        <!-- 标签栏 -->
                        <div class="code-tabs" id="tabs-${this.id}">
                            <div class="tab active" data-file="main.${this.getFileExtension()}">
                                <span class="tab-title">main.${this.getFileExtension()}</span>
                                <button class="tab-close">×</button>
                            </div>
                            <button class="tab-add" id="addTab-${this.id}" title="新建标签">+</button>
                        </div>
                        
                        <!-- Monaco Editor -->
                        <div class="monaco-editor-container" id="editor-${this.id}">
                            <!-- Monaco Editor 将在这里初始化 -->
                        </div>
                    </div>
                </div>
                
                <!-- 底部面板 -->
                <div class="code-bottom-panel">
                    <!-- 终端调整大小拖拽条 -->
                    <div class="terminal-resizer-horizontal" id="terminalResizer-${this.id}"></div>

                    <!-- 终端区域 -->
                    <div class="terminal-section">
                        <div class="terminal-header">
                            <div class="terminal-tabs">
                                <div class="terminal-tab active" data-terminal="terminal">
                                    <i class="fas fa-terminal"></i>
                                    <span>终端</span>
                                </div>
                                <div class="terminal-tab" data-terminal="output">
                                    <i class="fas fa-list-alt"></i>
                                    <span>输出</span>
                                </div>
                                <div class="terminal-tab" data-terminal="problems">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <span>问题</span>
                                </div>
                                <!-- 状态信息 -->
                                <div class="terminal-status-info">
                                    <div class="status-left">
                                        <span class="status-item" id="cursorPos-${this.id}">行 1, 列 1</span>
                                        <span class="status-item" id="encoding-${this.id}">UTF-8</span>
                                        <span class="status-item" id="lineEnding-${this.id}">LF</span>
                                    </div>
                                    <div class="status-right">
                                        <span class="status-item execution-status" id="execStatus-${this.id}">就绪</span>
                                        <span class="status-item language" id="languageStatus-${this.id}">${this.language.toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="terminal-controls">
                                <!-- 语言切换选择器 -->
                                <div class="language-selector">
                                    <select id="languageSelect-${this.id}" class="language-select" title="切换编程语言">
                                        <option value="javascript">JavaScript</option>
                                        <option value="python">Python</option>
                                        <option value="html">HTML</option>
                                        <option value="css">CSS</option>
                                        <option value="typescript">TypeScript</option>
                                        <option value="json">JSON</option>
                                        <option value="markdown">Markdown</option>
                                    </select>
                                </div>
                                <button class="terminal-btn" id="clearTerminalBtn-${this.id}" title="清空终端">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button class="terminal-btn" id="splitTerminalBtn-${this.id}" title="分割终端">
                                    <i class="fas fa-columns"></i>
                                </button>
                            </div>
                        </div>
                        <div class="terminal-content">
                            <div class="terminal-panel active" id="terminal-${this.id}">
                                <!-- XTerm.js 终端将在这里初始化 -->
                            </div>
                            <div class="terminal-panel" id="output-${this.id}">
                                <div class="output-content"></div>
                            </div>
                            <div class="terminal-panel" id="problems-${this.id}">
                                <div class="problems-content">
                                    <div class="no-problems">
                                        <i class="fas fa-check-circle"></i>
                                        <p>没有发现问题</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 隐藏的文件输入 -->
        <input type="file" id="fileInput-${this.id}" style="display: none;" multiple>
        `;

        document.body.appendChild(this.windowElement);

        // 获取关键元素引用
        this.editorContainer = document.getElementById(`editor-${this.id}`);
        this.terminalContainer = document.getElementById(`terminal-${this.id}`);
        this.fileExplorer = document.getElementById(`fileTree-${this.id}`);
        this.statusBar = document.getElementById(`statusBar-${this.id}`);
    }

    // 初始化Monaco编辑器
    async initializeEditor() {
        try {
            // 确保Monaco已加载
            if (!window.monaco) {
                console.log('Waiting for Monaco Editor to load...');
                let attempts = 0;
                while (!window.monaco && attempts < 100) { // 增加到10秒
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }

                if (!window.monaco) {
                    console.warn('Monaco Editor not available, using fallback editor');
                    this.createFallbackEditor();
                    return;
                }
            }

            console.log('Initializing Monaco Editor...');

            // 配置主题
            monaco.editor.defineTheme('vscode-dark-plus', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '6A9955' },
                    { token: 'keyword', foreground: '569CD6' },
                    { token: 'string', foreground: 'CE9178' },
                    { token: 'number', foreground: 'B5CEA8' },
                ],
                colors: {
                    'editor.background': '#1E1E1E',
                    'editor.foreground': '#D4D4D4',
                    'editorCursor.foreground': '#AEAFAD',
                    'editor.lineHighlightBackground': '#2A2D2E',
                    'editorLineNumber.foreground': '#858585',
                    'editor.selectionBackground': '#264F78',
                    'editor.inactiveSelectionBackground': '#3A3D41'
                }
            });

            // 创建编辑器实例
            this.editor = monaco.editor.create(this.editorContainer, {
                value: this.getDefaultCode(),
                language: this.language,
                theme: 'vscode-dark-plus',
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                fixedOverflowWidgets: true,
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'always',
                scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false,
                    verticalHasArrows: true,
                    horizontalHasArrows: true
                },
                // 智能提示
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                // 代码格式化
                formatOnPaste: true,
                formatOnType: true,
                // 括号匹配
                matchBrackets: 'always',
                // 代码折叠
                showUnused: true,
                // 错误提示
                glyphMargin: true,
                // 搜索
                find: {
                    seedSearchStringFromSelection: true,
                    autoFindInSelection: 'never'
                }
            });

            // 绑定编辑器事件
            this.editor.onDidChangeModelContent(() => {
                this.onCodeChange();
            });

            this.editor.onDidChangeCursorPosition((e) => {
                this.updateCursorPosition(e.position);
            });

            // 添加键盘快捷键
            this.addKeyboardShortcuts();

            console.log('Monaco Editor initialized successfully');

        } catch (error) {
            console.error('Editor initialization failed:', error);
            this.createFallbackEditor();
        }
    }

    // 创建回退编辑器
    createFallbackEditor() {
        console.log('Creating fallback editor...');

        const textarea = document.createElement('textarea');
        textarea.className = 'fallback-editor';
        textarea.style.cssText = `
            width: 100%;
            height: 100%;
            background: #1E1E1E;
            color: #D4D4D4;
            border: none;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            padding: 16px;
            resize: none;
            outline: none;
            line-height: 1.4;
            tab-size: 4;
        `;
        textarea.value = this.getDefaultCode();
        textarea.placeholder = '代码编辑器 (回退模式)';

        this.editorContainer.innerHTML = '';
        this.editorContainer.appendChild(textarea);

        // 创建模拟编辑器对象
        this.editor = {
            getValue: () => textarea.value,
            setValue: (value) => { textarea.value = value; },
            getModel: () => ({
                getLinesContent: () => textarea.value.split('\n'),
                getLineCount: () => textarea.value.split('\n').length
            }),
            updateOptions: () => { },
            layout: () => { },
            focus: () => textarea.focus(),
            onDidChangeModelContent: (callback) => {
                textarea.addEventListener('input', callback);
                return { dispose: () => textarea.removeEventListener('input', callback) };
            },
            onDidChangeCursorPosition: () => ({ dispose: () => { } }),
            addCommand: () => { },
            trigger: () => { },
            dispose: () => { }
        };

        // 绑定事件
        textarea.addEventListener('input', () => this.onCodeChange());
        textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.executeCode();
            }
        });
    }

    // 初始化终端
    async initializeTerminal() {
        try {
            // 确保XTerm已加载
            // if (!window.Terminal) {
            //     console.log('Waiting for XTerm.js to load...');
            //     let attempts = 0;
            //     while (!window.Terminal && attempts < 100) { // 增加到10秒
            //         await new Promise(resolve => setTimeout(resolve, 100));
            //         attempts++;
            //     }

            //     if (!window.Terminal) {
            //         console.warn('XTerm.js failed to load, using fallback terminal');
            //         this.createFallbackTerminal();
            //         return;
            //     }
            // }

            console.log('Initializing terminal...');

            // 获取终端容器
            this.terminalContainer = this.windowElement.querySelector(`#terminal-${this.id}`);
            if (!this.terminalContainer) {
                throw new Error('Terminal container not found');
            }

            // 检查Terminal是否可用
            if (typeof Terminal === 'undefined') {
                console.warn('XTerm.js Terminal not available, trying to load...');
                await this.loadXTermJS();

                if (typeof Terminal === 'undefined') {
                    throw new Error('XTerm.js Terminal not available after loading attempt');
                }
            }

            this.terminal = new Terminal({
                theme: {
                    background: '#1E1E1E',
                    foreground: '#D4D4D4',
                    cursor: '#AEAFAD',
                    black: '#000000',
                    red: '#F44747',
                    green: '#4FC1FF',
                    yellow: '#FFCC02',
                    blue: '#569CD6',
                    magenta: '#C586C0',
                    cyan: '#4FC1FF',
                    white: '#D4D4D4',
                    brightBlack: '#666666',
                    brightRed: '#F44747',
                    brightGreen: '#4FC1FF',
                    brightYellow: '#FFCC02',
                    brightBlue: '#569CD6',
                    brightMagenta: '#C586C0',
                    brightCyan: '#4FC1FF',
                    brightWhite: '#D4D4D4'
                },
                fontFamily: 'Consolas, "Courier New", monospace',
                fontSize: 14,
                rows: 20,
                cols: 100,
                scrollback: 1000,
                tabStopWidth: 4
            });

            this.terminal.open(this.terminalContainer);

            // 添加 FitAddon 支持
            if (window.FitAddon) {
                this.fitAddon = new FitAddon();
                this.terminal.loadAddon(this.fitAddon);
                this.fitAddon.fit();
            }

            // 终端欢迎信息
            this.terminal.writeln('\x1b[32m欢迎使用代码编辑器终端！\x1b[0m');
            this.terminal.writeln(`当前语言: ${this.language.toUpperCase()}`);
            this.terminal.writeln('输入代码并按 Ctrl+Enter 执行\n');

            // 处理终端输入
            this.setupTerminalInput();

            console.log('Terminal initialized successfully');

        } catch (error) {
            console.error('Terminal initialization failed:', error);
            this.createFallbackTerminal();
        }
    }

    // 创建回退终端
    createFallbackTerminal() {
        console.log('Creating fallback terminal...');

        // 创建简单的文本区域作为终端替代
        const fallbackTerminal = document.createElement('div');
        fallbackTerminal.className = 'fallback-terminal';
        fallbackTerminal.style.cssText = `
            background: #1E1E1E;
            color: #D4D4D4;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            padding: 12px;
            height: 100%;
            overflow-y: auto;
            white-space: pre-wrap;
            border: 1px solid #3C3C3C;
            border-radius: 4px;
        `;

        this.terminalContainer.innerHTML = '';
        this.terminalContainer.appendChild(fallbackTerminal);

        // 创建模拟终端对象
        this.terminal = {
            writeln: (text) => {
                // 移除ANSI颜色代码
                const cleanText = text.replace(/\x1b\[\d+m/g, '');
                fallbackTerminal.textContent += cleanText + '\n';
                fallbackTerminal.scrollTop = fallbackTerminal.scrollHeight;
            },
            write: (text) => {
                // 移除ANSI颜色代码
                const cleanText = text.replace(/\x1b\[\d+m/g, '');
                fallbackTerminal.textContent += cleanText;
                fallbackTerminal.scrollTop = fallbackTerminal.scrollHeight;
            },
            clear: () => {
                fallbackTerminal.textContent = '';
            },
            open: () => { },
            dispose: () => { }
        };

        // 显示欢迎信息
        this.terminal.writeln('欢迎使用代码编辑器终端！');
        this.terminal.writeln(`当前语言: ${this.language.toUpperCase()}`);
        this.terminal.writeln('输入代码并按 Ctrl+Enter 执行\n');
        this.terminal.write('> ');
    }

    // 初始化执行引擎
    async initializeExecutionEngine() {
        this.executionEngine = new CodeExecutionEngine(this.language);
        await this.executionEngine.initialize();
        this.bindExecutionEngineEvents();
    }

    // 初始化文件系统
    initializeFileSystem() {
        // 创建默认文件结构
        this.fileTree.set('/', {
            type: 'directory',
            name: '/',
            children: new Set(['main.' + this.getFileExtension()])
        });

        this.fileTree.set('/main.' + this.getFileExtension(), {
            type: 'file',
            name: 'main.' + this.getFileExtension(),
            content: this.getDefaultCode(),
            language: this.language
        });

        this.currentFile = '/main.' + this.getFileExtension();
        this.renderFileTree();
    }

    // 初始化AI助手
    initializeAIAssistant() {
        this.aiAssistant = new AICodeAssistant(this);

        // 确保侧边栏正确显示
        this.initializeSidebar();
    }

    // 初始化侧边栏
    initializeSidebar() {
        const sidebar = this.windowElement.querySelector('.code-sidebar');
        const fileSection = this.windowElement.querySelector('.sidebar-section:first-child');
        const aiSection = this.windowElement.querySelector('.ai-panel');

        // 从localStorage加载保存的尺寸
        const savedSidebarWidth = localStorage.getItem(`code-editor-sidebar-width-${this.id}`);
        const savedTerminalHeight = localStorage.getItem(`code-editor-terminal-height-${this.id}`);
        const savedAIPanelHeight = localStorage.getItem(`code-editor-ai-panel-height-${this.id}`);

        if (savedSidebarWidth) {
            this.sidebarWidth = parseInt(savedSidebarWidth, 10);
        }
        if (savedTerminalHeight) {
            this.terminalHeight = parseInt(savedTerminalHeight, 10);
        }
        if (savedAIPanelHeight) {
            this.aiPanelHeight = parseInt(savedAIPanelHeight, 10);
        }

        // 确保文件浏览器部分可见
        if (fileSection) {
            fileSection.style.display = 'block';
            fileSection.style.flex = '1';
        }

        // 确保AI面板初始隐藏，但设置正确的高度
        if (aiSection) {
            aiSection.style.display = 'none';
            aiSection.style.height = this.aiPanelHeight + 'px';
            aiSection.style.flex = 'none';
        }

        // 设置侧边栏尺寸
        if (sidebar) {
            sidebar.style.width = this.sidebarWidth + 'px';
            sidebar.style.minHeight = '400px';
            sidebar.style.height = '100%';
        }

        // 设置终端高度
        const bottomPanel = this.windowElement.querySelector('.code-bottom-panel');
        if (bottomPanel) {
            bottomPanel.style.height = this.terminalHeight + 'px';
            bottomPanel.style.flexShrink = '0';
        }

        // 确保主区域使用flex布局
        const mainArea = this.windowElement.querySelector('.code-main-area');
        if (mainArea) {
            mainArea.style.flex = '1';
            mainArea.style.overflow = 'hidden';
        }

        // 确保文件树容器有足够高度
        if (this.fileExplorer) {
            this.fileExplorer.style.minHeight = '200px';
            this.fileExplorer.style.overflowY = 'auto';
        }
    }

    // 绑定事件
    bindEvents() {
        // 窗口控制
        this.windowElement.querySelector('.code-btn-minimize').addEventListener('click', () => this.minimize());
        this.windowElement.querySelector('.code-btn-close').addEventListener('click', () => this.close());

        // 代码执行
        document.getElementById(`runBtn-${this.id}`).addEventListener('click', () => this.runCode());
        document.getElementById(`stopBtn-${this.id}`).addEventListener('click', () => this.stopExecution());

        // AI助手
        document.getElementById(`aiBtn-${this.id}`).addEventListener('click', () => this.toggleAI());
        document.getElementById(`aiSendBtn-${this.id}`).addEventListener('click', () => this.sendAIMessage());
        document.getElementById(`aiCloseBtn-${this.id}`).addEventListener('click', () => this.closeAI());

        // 底部面板标签页切换
        this.bindTerminalTabEvents();

        // 设置AI按钮初始状态
        const aiBtn = document.getElementById(`aiBtn-${this.id}`);
        if (aiBtn && this.isAIMode) {
            aiBtn.classList.add('active');
        }

        // 文件操作
        document.getElementById(`newFileBtn-${this.id}`).addEventListener('click', () => this.createNewFile());
        document.getElementById(`newFolderBtn-${this.id}`).addEventListener('click', () => this.createNewFolder());
        document.getElementById(`uploadBtn-${this.id}`).addEventListener('click', () => this.uploadFile());

        // 设置按钮
        document.getElementById(`settingsBtn-${this.id}`).addEventListener('click', () => this.openSettings());

        // 节点生成
        document.getElementById(`nodeBtn-${this.id}`).addEventListener('click', () => this.toggleNode());

        // 终端控制
        document.getElementById(`clearTerminalBtn-${this.id}`).addEventListener('click', () => this.clearTerminal());

        // 语言切换
        const languageSelect = document.getElementById(`languageSelect-${this.id}`);
        languageSelect.value = this.language;
        languageSelect.addEventListener('change', (e) => this.switchLanguage(e.target.value));

        // 标签页
        this.bindTabEvents();

        // 窗口拖拽
        this.makeDraggable();

        // AI输入框回车事件
        document.getElementById(`aiInput-${this.id}`).addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendAIMessage();
            }
        });

        // 终端标签页切换
        this.bindTerminalTabs();

        // 调整大小功能
        this.initializeResizers();

        // 键盘快捷键
        this.bindKeyboardShortcuts();
    }

    // 绑定终端标签页事件
    bindTerminalTabs() {
        const terminalTabs = this.windowElement.querySelectorAll('.terminal-tab');
        const terminalPanels = this.windowElement.querySelectorAll('.terminal-panel');

        terminalTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 移除所有活动状态
                terminalTabs.forEach(t => t.classList.remove('active'));
                terminalPanels.forEach(p => p.classList.remove('active'));

                // 添加当前活动状态
                tab.classList.add('active');
                const targetTerminal = tab.getAttribute('data-terminal');
                const targetPanel = this.windowElement.querySelector(`#${targetTerminal}-${this.id}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');

                    // 如果切换回终端面板，确保终端正确显示
                    if (targetTerminal === 'terminal' && this.terminal) {
                        // 确保终端容器可见
                        const terminalContainer = this.windowElement.querySelector(`#terminal-${this.id}`);
                        if (terminalContainer) {
                            terminalContainer.style.display = 'block';
                        }

                        // 给终端一些时间来重新渲染
                        setTimeout(() => {
                            if (this.terminal.fit && typeof this.terminal.fit === 'function') {
                                this.terminal.fit();
                            } else if (this.fitAddon && typeof this.fitAddon.fit === 'function') {
                                this.fitAddon.fit();
                            }

                            // 强制重新打开终端
                            if (this.terminal.open && this.terminalContainer) {
                                this.terminal.open(this.terminalContainer);
                            }
                        }, 150);
                    }
                }

                // 初始化面板内容
                this.initializePanelContent(targetTerminal);
            });
        });

        // 初始化默认面板内容
        this.initializePanelContent('terminal');
        this.initializePanelContent('output');
        this.initializePanelContent('problems');
    }

    // 初始化面板内容
    initializePanelContent(panelType) {
        switch (panelType) {
            case 'output':
                this.initializeOutputPanel();
                break;
            case 'problems':
                this.initializeProblemsPanel();
                break;
            case 'terminal':
                // 终端已在 initializeTerminal 中初始化
                break;
        }
    }

    // 初始化输出面板
    initializeOutputPanel() {
        const outputPanel = this.windowElement.querySelector(`#output-${this.id} .output-content`);
        if (outputPanel && !outputPanel.hasAttribute('data-initialized')) {
            outputPanel.setAttribute('data-initialized', 'true');
            outputPanel.innerHTML = `
                <div class="output-header">
                    <h4><i class="fas fa-list-alt"></i> 代码输出</h4>
                    <button class="clear-output-btn" onclick="this.parentElement.nextElementSibling.innerHTML = ''">
                        <i class="fas fa-trash"></i> 清空
                    </button>
                </div>
                <div class="output-messages">
                    <div class="output-message info">
                        <i class="fas fa-info-circle"></i>
                        <span>程序输出将显示在这里</span>
                    </div>
                </div>
            `;
        }
    }

    // 初始化问题面板
    initializeProblemsPanel() {
        const problemsPanel = this.windowElement.querySelector(`#problems-${this.id} .problems-content`);
        if (problemsPanel && !problemsPanel.hasAttribute('data-initialized')) {
            problemsPanel.setAttribute('data-initialized', 'true');
            problemsPanel.innerHTML = `
                <div class="problems-header">
                    <h4><i class="fas fa-exclamation-triangle"></i> 问题</h4>
                    <span class="problems-count">0 个问题</span>
                </div>
                <div class="problems-list">
                    <div class="no-problems">
                        <i class="fas fa-check-circle"></i>
                        <p>没有发现问题</p>
                        <small>代码检查和错误将显示在这里</small>
                    </div>
                </div>
            `;
        }
    }

    // 添加输出消息
    addOutputMessage(message, type = 'info') {
        const outputMessages = this.windowElement.querySelector(`#output-${this.id} .output-messages`);
        if (outputMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = `output-message ${type}`;

            const icon = type === 'error' ? 'fas fa-times-circle' :
                type === 'warning' ? 'fas fa-exclamation-triangle' :
                    type === 'success' ? 'fas fa-check-circle' : 'fas fa-info-circle';

            messageElement.innerHTML = `
                <i class="${icon}"></i>
                <span>${message}</span>
                <small>${new Date().toLocaleTimeString()}</small>
            `;

            outputMessages.appendChild(messageElement);
            outputMessages.scrollTop = outputMessages.scrollHeight;
        }
    }

    // 获取文件扩展名
    getFileExtension() {
        const extensions = {
            javascript: 'js',
            python: 'py',
            html: 'html',
            css: 'css',
            typescript: 'ts',
            json: 'json',
            markdown: 'md'
        };
        return extensions[this.language] || 'txt';
    }

    // 获取默认代码
    getDefaultCode() {
        const templates = {
            javascript: `// JavaScript 代码示例
console.log("Hello, World!");

// 计算斐波那契数列
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("斐波那契数列前10项:");
for (let i = 0; i < 10; i++) {
    console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}`,
            python: `# Python 代码示例
print("Hello, World!")

# 计算斐波那契数列
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print("斐波那契数列前10项:")
for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")

# 数据处理示例
import math
numbers = [1, 4, 9, 16, 25]
sqrt_numbers = [math.sqrt(x) for x in numbers]
print("平方根:", sqrt_numbers)`,
            html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello, World!</h1>
        <p>这是一个简单的HTML页面示例</p>
        <button onclick="showAlert()">点击我</button>
    </div>
    
    <script>
        function showAlert() {
            alert('Hello from JavaScript!');
        }
    </script>
</body>
</html>`,
            css: `/* CSS 样式示例 */
body {
    font-family: 'Arial', sans-serif;
    margin: 0;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 15px;
    backdrop-filter: blur(10px);
}

.title {
    font-size: 2.5em;
    text-align: center;
    margin-bottom: 30px;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.button {
    display: inline-block;
    padding: 12px 24px;
    background: #ff6b6b;
    color: white;
    text-decoration: none;
    border-radius: 25px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}`,
            typescript: `// TypeScript 代码示例
interface User {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
}

class UserManager {
    private users: User[] = [];

    addUser(user: User): void {
        this.users.push(user);
        console.log(\`用户 \${user.name} 已添加\`);
    }

    findUser(id: number): User | undefined {
        return this.users.find(user => user.id === id);
    }

    getActiveUsers(): User[] {
        return this.users.filter(user => user.isActive);
    }
}

// 使用示例
const userManager = new UserManager();
userManager.addUser({
    id: 1,
    name: "张三",
    email: "zhangsan@example.com",
    isActive: true
});

console.log("活跃用户:", userManager.getActiveUsers());`,
            json: `{
  "name": "示例项目",
  "version": "1.0.0",
  "description": "这是一个JSON配置文件示例",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21",
    "axios": "^1.3.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.0.0",
    "webpack": "^5.75.0"
  },
  "keywords": ["node", "javascript", "web"],
  "author": "开发者",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/example/project.git"
  }
}`,
            markdown: `# Markdown 文档示例

## 简介
这是一个 **Markdown** 文档示例，展示了常用的格式化语法。

## 文本格式
- *斜体文本*
- **粗体文本**
- ***粗斜体文本***
- ~~删除线文本~~

## 列表
### 无序列表
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2
- 项目 3

### 有序列表
1. 第一步
2. 第二步
3. 第三步

## 代码
### 行内代码
使用 \`console.log()\` 输出信息。

### 代码块
\`\`\`javascript
function greet(name) {
    return \`Hello, \${name}!\`;
}
console.log(greet("World"));
\`\`\`

## 链接和图片
[GitHub](https://github.com)

## 表格
| 姓名 | 年龄 | 职业 |
|------|------|------|
| 张三 | 25   | 工程师 |
| 李四 | 30   | 设计师 |

## 引用
> 这是一个引用示例
> 可以包含多行内容

---
*文档创建时间: ${new Date().toLocaleString()}*`
        };
        return templates[this.language] || '// 开始编写你的代码...';
    }

    // 切换编程语言
    async switchLanguage(newLanguage) {
        if (newLanguage === this.language) return;

        const oldLanguage = this.language;
        this.language = newLanguage;

        // 更新窗口标题中的语言标识
        const languageBadge = this.windowElement.querySelector('.language-badge');
        if (languageBadge) {
            languageBadge.textContent = newLanguage.toUpperCase();
        }

        // 更新状态栏中的语言显示
        const languageStatus = document.getElementById(`languageStatus-${this.id}`);
        if (languageStatus) {
            languageStatus.textContent = newLanguage.toUpperCase();
        }

        // 更新编辑器语言
        if (this.editor && this.editor.getModel) {
            const model = this.editor.getModel();
            if (model && window.monaco) {
                window.monaco.editor.setModelLanguage(model, newLanguage);
            }
        }

        // 如果当前文件是默认文件，更新其内容为新语言的示例代码
        const currentFileName = `main.${this.getFileExtension()}`;
        if (this.currentFile === '/' + currentFileName) {
            const newFileName = `main.${this.getFileExtension()}`;
            const newContent = this.getDefaultCode();

            // 更新编辑器内容
            if (this.editor) {
                this.editor.setValue(newContent);
            }

            // 更新文件树
            this.fileTree.delete(this.currentFile);
            this.currentFile = '/' + newFileName;
            this.fileTree.set(this.currentFile, {
                type: 'file',
                name: newFileName,
                content: newContent,
                language: newLanguage
            });

            // 更新标签页
            const activeTab = this.windowElement.querySelector('.tab.active .tab-title');
            if (activeTab) {
                activeTab.textContent = newFileName;
            }

            this.renderFileTree();
        }

        // 重新初始化执行引擎
        try {
            if (this.executionEngine) {
                this.executionEngine.destroy();
            }
            this.executionEngine = new CodeExecutionEngine(newLanguage);
            await this.executionEngine.initialize();
            this.bindExecutionEngineEvents();
        } catch (error) {
            console.warn('执行引擎初始化失败:', error.message);
            // 创建一个基础的执行引擎
            this.executionEngine = {
                execute: async (code) => {
                    if (this.terminal && this.terminal.writeln) {
                        this.terminal.writeln(`\x1b[33m${newLanguage} 代码:\x1b[0m`);
                        this.terminal.writeln(code);
                        this.terminal.writeln('\x1b[32m代码已显示（执行引擎未完全初始化）\x1b[0m');
                    }
                },
                destroy: () => { },
                onOutput: () => { },
                onError: () => { },
                onComplete: () => { }
            };
        }

        // 如果是Python，显示Python模式提示
        if (newLanguage === 'python') {
            try {
                await this.initializePythonEnvironment();
            } catch (error) {
                console.warn('Python环境初始化跳过:', error.message);
            }
        }

        // 显示切换通知
        this.terminal.writeln(`\x1b[32m语言已切换: ${oldLanguage.toUpperCase()} → ${newLanguage.toUpperCase()}\x1b[0m`);
        Utils.showNotification(`语言已切换为 ${newLanguage.toUpperCase()}`, 'success');
    }

    // 初始化Python环境
    async initializePythonEnvironment() {
        try {
            if (!window.pyodide) {
                if (this.terminal && this.terminal.writeln) {
                    this.terminal.writeln('\x1b[33m正在加载Python环境...\x1b[0m');
                }

                // 简化的Python环境提示
                if (this.terminal && this.terminal.writeln) {
                    this.terminal.writeln('\x1b[32mPython模式已激活！\x1b[0m');
                    this.terminal.writeln('\x1b[33m注意: 完整的Python执行需要Pyodide环境\x1b[0m');
                }
            }
        } catch (error) {
            console.error('Python环境初始化失败:', error);
            if (this.terminal && this.terminal.writeln) {
                this.terminal.writeln('\x1b[31mPython环境初始化失败\x1b[0m');
            }
        }
    }

    // 加载外部脚本的辅助方法
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 绑定执行引擎事件
    bindExecutionEngineEvents() {
        // 监听执行结果
        this.executionEngine.onOutput((data) => {
            if (this.terminal && this.terminal.write) {
                this.terminal.write(data);
            }
            // 同时添加到输出面板
            this.addOutputMessage(data.replace(/\x1b\[\d+m/g, ''), 'info');
        });

        this.executionEngine.onError((error) => {
            if (this.terminal && this.terminal.writeln) {
                this.terminal.writeln(`\x1b[31m错误: ${error}\x1b[0m`);
            }
            // 添加到输出面板和问题面板
            this.addOutputMessage(`错误: ${error}`, 'error');
            this.updateProblems([{ message: error, line: 0, severity: 'error' }]);
        });

        this.executionEngine.onComplete(() => {
            this.isExecuting = false;
            this.updateExecutionStatus('就绪');
            this.addOutputMessage('代码执行完成', 'success');
        });
    }

    // 运行代码
    async runCode() {
        if (this.isExecuting) {
            Utils.showNotification('代码正在执行中...', 'warning');
            return;
        }

        const code = this.editor.getValue();
        if (!code.trim()) {
            Utils.showNotification('请输入代码', 'warning');
            return;
        }

        this.isExecuting = true;
        this.updateExecutionStatus('运行中...');

        try {
            await this.executionEngine.execute(code);
            Utils.showNotification('代码执行完成', 'success');
        } catch (error) {
            Utils.showNotification('执行失败: ' + error.message, 'error');
        }
    }

    // 停止执行
    stopExecution() {
        if (this.executionEngine) {
            this.executionEngine.stop();
        }
        this.isExecuting = false;
        this.updateExecutionStatus('已停止');
        this.terminal.writeln('\n\x1b[33m执行已停止\x1b[0m');
    }

    // 切换AI助手
    toggleAI() {
        const aiPanel = document.getElementById(`aiPanel-${this.id}`);
        const aiBtn = document.getElementById(`aiBtn-${this.id}`);
        const aiResizer = document.getElementById(`aiResizer-${this.id}`);

        if (this.isAIMode) {
            aiPanel.style.display = 'none';
            if (aiResizer) aiResizer.style.display = 'none';
            aiBtn.classList.remove('active');
            this.isAIMode = false;
        } else {
            aiPanel.style.display = 'block';
            if (aiResizer) aiResizer.style.display = 'block';
            aiBtn.classList.add('active');
            this.isAIMode = true;

            // 设置AI面板初始高度，并调整文件浏览器高度
            aiPanel.style.height = this.aiPanelHeight + 'px';
            aiPanel.style.flex = 'none';

            const fileSection = this.windowElement.querySelector('.sidebar-section:first-child');
            if (fileSection) {
                fileSection.style.flex = '1';
                fileSection.style.height = 'auto';
            }
        }
    }

    // 发送AI消息
    async sendAIMessage() {
        const input = document.getElementById(`aiInput-${this.id}`);
        const message = input.value.trim();

        if (!message) return;

        // 清空输入框
        input.value = '';

        // 显示用户消息
        this.addAIMessage('user', message);

        try {
            // 发送给AI助手
            const response = await this.aiAssistant.processMessage(message, this.editor.getValue());
            this.addAIMessage('assistant', response);
        } catch (error) {
            this.addAIMessage('error', '抱歉，AI助手暂时不可用: ' + error.message);
        }
    }

    // 添加AI消息
    addAIMessage(role, content) {
        const messagesContainer = document.getElementById(`aiMessages-${this.id}`);
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-message-${role}`;

        const iconClass = role === 'user' ? 'fa-user' : role === 'error' ? 'fa-exclamation-triangle' : 'fa-robot';

        messageDiv.innerHTML = `
            <div class="ai-message-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="ai-message-content">
                <div class="ai-message-text">${this.formatAIMessage(content)}</div>
                <div class="ai-message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 格式化AI消息
    formatAIMessage(content) {
        // 处理代码块
        return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre class="ai-code-block"><code class="language-${lang || 'text'}">${Utils.escapeHtml(code)}</code></pre>`;
        }).replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
    }

    // 关闭AI助手
    closeAI() {
        this.isAIMode = false;
        document.getElementById(`aiPanel-${this.id}`).style.display = 'none';
        document.getElementById(`aiBtn-${this.id}`).classList.remove('active');

        const aiResizer = document.getElementById(`aiResizer-${this.id}`);
        if (aiResizer) aiResizer.style.display = 'none';

        // 重置文件浏览器区域为flex布局
        const fileSection = this.windowElement.querySelector('.sidebar-section:first-child');
        if (fileSection) {
            fileSection.style.flex = '1';
            fileSection.style.height = 'auto';
        }
    }

    // 创建新文件
    createNewFile() {
        const name = prompt('输入文件名:');
        if (!name) return;

        const fullPath = '/' + name;
        if (this.fileTree.has(fullPath)) {
            Utils.showNotification('文件已存在', 'warning');
            return;
        }

        this.fileTree.set(fullPath, {
            type: 'file',
            name: name,
            content: '',
            language: this.detectLanguage(name)
        });

        this.renderFileTree();
        this.openFile(fullPath);
    }

    // 创建新文件夹
    createNewFolder() {
        const name = prompt('输入文件夹名:');
        if (!name) return;

        const fullPath = '/' + name;
        if (this.fileTree.has(fullPath)) {
            Utils.showNotification('文件夹已存在', 'warning');
            return;
        }

        this.fileTree.set(fullPath, {
            type: 'folder',
            name: name,
            children: []
        });

        this.renderFileTree();
        Utils.showNotification(`文件夹 "${name}" 创建成功`, 'success');
    }

    // 上传文件
    uploadFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.js,.py,.html,.css,.ts,.json,.md,.txt';

        input.onchange = (e) => {
            const files = Array.from(e.target.files);

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target.result;
                    const fullPath = '/' + file.name;

                    if (this.fileTree.has(fullPath)) {
                        if (!confirm(`文件 "${file.name}" 已存在，是否覆盖？`)) {
                            return;
                        }
                    }

                    this.fileTree.set(fullPath, {
                        type: 'file',
                        name: file.name,
                        content: content,
                        language: this.detectLanguage(file.name)
                    });

                    this.renderFileTree();
                    Utils.showNotification(`文件 "${file.name}" 上传成功`, 'success');
                };
                reader.readAsText(file);
            });
        };

        input.click();
    }

    // 检测编程语言
    detectLanguage(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
            'js': 'javascript',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'ts': 'typescript',
            'json': 'json',
            'md': 'markdown'
        };
        return langMap[ext] || 'text';
    }

    // 渲染文件树
    renderFileTree() {
        const container = this.fileExplorer;
        container.innerHTML = '';

        // 渲染根目录下的文件和文件夹
        const rootItems = Array.from(this.fileTree.keys()).filter(path =>
            path !== '/' && !path.includes('/', 1)
        );

        rootItems.forEach(itemPath => {
            const item = this.fileTree.get(itemPath);
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item';
            if (itemPath === this.currentFile) {
                itemElement.classList.add('active');
            }

            // 根据类型选择不同的图标
            const icon = item.type === 'folder' ? 'fas fa-folder' : 'fas fa-file-code';
            const clickAction = item.type === 'folder' ? 'toggleFolder' : 'openFile';

            itemElement.innerHTML = `
                <div class="file-content" data-path="${itemPath}" data-type="${item.type}" data-action="${clickAction}">
                    <i class="${icon}"></i>
                    <span class="file-name">${item.name}</span>
                </div>
                <div class="file-actions">
                    <button class="file-action-btn" data-action="delete" data-path="${itemPath}" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            container.appendChild(itemElement);
        });

        // 绑定文件/文件夹点击事件
        container.removeEventListener('click', this.fileTreeClickHandler);
        this.fileTreeClickHandler = (e) => {
            const fileContent = e.target.closest('.file-content');
            const actionBtn = e.target.closest('.file-action-btn');

            if (fileContent) {
                const path = fileContent.dataset.path;
                const type = fileContent.dataset.type;
                const action = fileContent.dataset.action;

                if (action === 'openFile' && type === 'file') {
                    this.openFile(path);
                } else if (action === 'toggleFolder' && type === 'folder') {
                    this.toggleFolder(path);
                }
            } else if (actionBtn) {
                const action = actionBtn.dataset.action;
                const path = actionBtn.dataset.path;

                if (action === 'delete') {
                    this.deleteFile(path);
                }
            }
        };

        container.addEventListener('click', this.fileTreeClickHandler);
    }

    // 切换文件夹展开/收起
    toggleFolder(folderPath) {
        const folder = this.fileTree.get(folderPath);
        if (folder && folder.type === 'folder') {
            folder.expanded = !folder.expanded;
            this.renderFileTree();
            Utils.showNotification(`文件夹 "${folder.name}" ${folder.expanded ? '已展开' : '已收起'}`, 'info');
        }
    }

    // 打开文件
    openFile(filePath) {
        const file = this.fileTree.get(filePath);
        if (!file) return;

        this.currentFile = filePath;
        this.editor.setValue(file.content);
        monaco.editor.setModelLanguage(this.editor.getModel(), file.language);

        // 更新活动状态
        this.renderFileTree();

        // 更新状态栏
        this.updateLanguageStatus(file.language);
    }

    // 删除文件
    deleteFile(filePath) {
        if (filePath === this.currentFile) {
            Utils.showNotification('无法删除当前打开的文件', 'warning');
            return;
        }

        if (confirm('确定要删除这个文件吗？')) {
            this.fileTree.delete(filePath);
            this.renderFileTree();
            Utils.showNotification('文件已删除', 'success');
        }
    }

    // 代码改变事件
    onCodeChange() {
        if (this.currentFile) {
            const file = this.fileTree.get(this.currentFile);
            if (file) {
                file.content = this.editor.getValue();
            }
        }
    }

    // 更新光标位置
    updateCursorPosition(position) {
        const cursorPosElement = document.getElementById(`cursorPos-${this.id}`);
        if (cursorPosElement) {
            cursorPosElement.textContent = `行 ${position.lineNumber}, 列 ${position.column}`;
        }
    }

    // 更新执行状态
    updateExecutionStatus(status) {
        const statusElement = document.getElementById(`execStatus-${this.id}`);
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    // 更新语言状态
    updateLanguageStatus(language) {
        const langElement = document.getElementById(`languageStatus-${this.id}`);
        if (langElement) {
            langElement.textContent = language.toUpperCase();
        }
    }

    // 更新问题面板
    updateProblems(problems) {
        const problemsList = this.windowElement.querySelector(`#problems-${this.id} .problems-list`);
        const problemsCount = this.windowElement.querySelector(`#problems-${this.id} .problems-count`);

        if (!problemsList) return;

        // 更新问题计数
        if (problemsCount) {
            problemsCount.textContent = `${problems.length} 个问题`;
        }

        if (problems.length === 0) {
            problemsList.innerHTML = `
                <div class="no-problems">
                    <i class="fas fa-check-circle"></i>
                    <p>没有发现问题</p>
                    <small>代码检查和错误将显示在这里</small>
                </div>
            `;
        } else {
            problemsList.innerHTML = problems.map((problem) => `
                <div class="problem-item ${problem.severity}" data-line="${problem.line}">
                    <i class="fas fa-${problem.severity === 'error' ? 'times-circle' : 'exclamation-triangle'}"></i>
                    <div class="problem-details">
                        <div class="problem-message">${problem.message}</div>
                        <div class="problem-location">行 ${problem.line || 'N/A'}</div>
                    </div>
                    <button class="goto-problem-btn" onclick="this.gotoLine(${problem.line || 1})" title="跳转到行">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // 添加键盘快捷键
    addKeyboardShortcuts() {
        // Ctrl+R 运行代码
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_R, () => {
            this.runCode();
        });

        // Ctrl+Shift+C 清空终端
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KEY_C, () => {
            this.clearTerminal();
        });

        // Ctrl+` 切换终端
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_BACKTICK, () => {
            this.toggleTerminal();
        });
    }

    // 设置终端输入处理
    setupTerminalInput() {
        let currentInput = '';

        this.terminal.onData(data => {
            if (data === '\r') { // Enter
                this.terminal.writeln('');
                if (currentInput.trim()) {
                    this.executeTerminalCommand(currentInput.trim());
                }
                currentInput = '';
                this.terminal.write('> ');
            } else if (data === '\u007F') { // Backspace
                if (currentInput.length > 0) {
                    currentInput = currentInput.slice(0, -1);
                    this.terminal.write('\b \b');
                }
            } else if (data >= ' ' || data === '\t') { // 可打印字符和制表符
                currentInput += data;
                this.terminal.write(data);
            }
        });

        this.terminal.write('> ');
    }

    // 执行终端命令
    async executeTerminalCommand(command) {
        try {
            await this.executionEngine.executeCommand(command);
        } catch (error) {
            this.terminal.writeln(`\x1b[31m错误: ${error.message}\x1b[0m`);
        }
    }

    // 清空终端
    clearTerminal() {
        if (this.terminal && typeof this.terminal.clear === 'function') {
            this.terminal.clear();
            this.terminal.writeln('\x1b[32m终端已清空\x1b[0m');
            this.terminal.write('> ');
        } else {
            console.warn('Terminal not available for clearing');
        }
    }

    // 切换终端显示
    toggleTerminal() {
        const bottomPanel = this.windowElement.querySelector('.code-bottom-panel');
        if (bottomPanel.style.display === 'none') {
            bottomPanel.style.display = 'block';
        } else {
            bottomPanel.style.display = 'none';
        }
    }

    // 绑定标签页事件
    bindTabEvents() {
        const tabsContainer = document.getElementById(`tabs-${this.id}`);

        tabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            const closeBtn = e.target.closest('.tab-close');

            if (closeBtn) {
                // 关闭标签页
                const tab = closeBtn.closest('.tab');
                if (tab && !tab.classList.contains('active')) {
                    tab.remove();
                }
            } else if (tab) {
                // 切换标签页
                const fileName = tab.dataset.file;
                if (fileName) {
                    this.switchTab(fileName);
                }
            }
        });
    }

    // 切换标签页
    switchTab(fileName) {
        // 更新活动标签
        document.querySelectorAll(`#tabs-${this.id} .tab`).forEach(tab => {
            tab.classList.remove('active');
        });

        const activeTab = document.querySelector(`#tabs-${this.id} .tab[data-file="${fileName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 打开对应文件
        const filePath = '/' + fileName;
        this.openFile(filePath);
    }

    // 打开设置面板
    openSettings() {
        // 创建设置对话框
        const settingsDialog = document.createElement('div');
        settingsDialog.className = 'settings-dialog-overlay';
        settingsDialog.innerHTML = `
            <div class="settings-dialog">
                <div class="settings-header">
                    <h3><i class="fas fa-cog"></i> 编辑器设置</h3>
                    <button class="close-btn" onclick="this.closest('.settings-dialog-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="settings-content">
                    <div class="setting-group">
                        <label>字体大小:</label>
                        <input type="range" id="fontSize-${this.id}" min="10" max="24" value="14"
                               oninput="this.nextElementSibling.textContent = this.value + 'px'">
                        <span>14px</span>
                    </div>
                    <div class="setting-group">
                        <label>主题:</label>
                        <select id="theme-${this.id}">
                            <option value="vs-dark">深色主题</option>
                            <option value="vs">浅色主题</option>
                            <option value="hc-black">高对比度</option>
                        </select>
                    </div>
                    <div class="setting-group">
                        <label>自动保存:</label>
                        <input type="checkbox" id="autoSave-${this.id}" checked>
                        <span>启用自动保存</span>
                    </div>
                    <div class="setting-group">
                        <label>代码格式化:</label>
                        <button class="settings-btn" onclick="window.currentEditor?.formatCode()">
                            <i class="fas fa-magic"></i> 格式化代码
                        </button>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="settings-btn primary" onclick="this.closest('.settings-dialog-overlay').remove()">
                        确定
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(settingsDialog);
        window.currentEditor = this;

        // 绑定设置事件
        this.bindSettingsEvents(settingsDialog);
    }

    // 绑定设置事件
    bindSettingsEvents(dialog) {
        const fontSizeSlider = dialog.querySelector(`#fontSize-${this.id}`);
        const themeSelect = dialog.querySelector(`#theme-${this.id}`);
        const autoSaveCheckbox = dialog.querySelector(`#autoSave-${this.id}`);

        if (fontSizeSlider) {
            fontSizeSlider.addEventListener('input', (e) => {
                const fontSize = parseInt(e.target.value);
                if (this.editor && this.editor.updateOptions) {
                    this.editor.updateOptions({ fontSize });
                }
            });
        }

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                if (this.editor && window.monaco) {
                    window.monaco.editor.setTheme(e.target.value);
                }
            });
        }

        if (autoSaveCheckbox) {
            autoSaveCheckbox.addEventListener('change', (e) => {
                this.autoSave = e.target.checked;
                Utils.showNotification(
                    `自动保存已${this.autoSave ? '启用' : '禁用'}`,
                    'info'
                );
            });
        }
    }

    // 格式化代码
    formatCode() {
        if (this.editor && this.editor.getAction) {
            const formatAction = this.editor.getAction('editor.action.formatDocument');
            if (formatAction) {
                formatAction.run();
                Utils.showNotification('代码已格式化', 'success');
            }
        }
    }

    // 生成工作流节点
    toggleNode() {
        if (!this.nodeCreated) {
            this.createWorkflowNode();
            document.getElementById(`nodeBtn-${this.id}`).innerHTML = '<i class="fas fa-minus-circle"></i>';
            this.nodeCreated = true;
        } else {
            this.removeWorkflowNode();
            document.getElementById(`nodeBtn-${this.id}`).innerHTML = '<i class="fas fa-plus-circle"></i>';
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
            const node = window.workflowManager.createNode('code-editor', {
                x: 300,
                y: 200,
                config: {
                    editorId: this.id,
                    language: this.language,
                    title: this.title
                }
            });

            this.linkedNode = node;
            Utils.showNotification('已生成代码编辑器节点', 'success');

        } catch (error) {
            Utils.showNotification('创建节点失败: ' + error.message, 'error');
        }
    }

    // 移除工作流节点
    removeWorkflowNode() {
        try {
            if (this.linkedNode && window.workflowManager) {
                // 检查workflowManager的可用方法
                if (typeof window.workflowManager.removeNode === 'function') {
                    window.workflowManager.removeNode(this.linkedNode.id);
                } else if (typeof window.workflowManager.deleteNode === 'function') {
                    window.workflowManager.deleteNode(this.linkedNode.id);
                } else if (window.workflowManager.nodes && window.workflowManager.nodes.delete) {
                    window.workflowManager.nodes.delete(this.linkedNode.id);
                } else {
                    console.warn('workflowManager没有可用的节点移除方法');
                    Utils.showNotification('节点移除功能暂不可用', 'warning');
                    return;
                }

                this.linkedNode = null;
                Utils.showNotification('已移除代码编辑器节点', 'success');
            } else {
                Utils.showNotification('没有关联的节点可移除', 'info');
            }
        } catch (error) {
            console.error('移除节点失败:', error);
            Utils.showNotification('移除节点失败: ' + error.message, 'error');
        }
    }

    // 窗口拖拽
    makeDraggable() {
        const header = this.windowElement.querySelector('.code-window-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = this.position.x;
        let yOffset = this.position.y;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.code-window-controls')) return;

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
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

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // 显示窗口
    show() {
        this.windowElement.style.display = 'block';
        this.isVisible = true;

        // 刷新编辑器布局
        if (this.editor) {
            setTimeout(() => this.editor.layout(), 100);
        }

        // 刷新终端布局
        if (this.terminal) {
            setTimeout(() => this.terminal.fit && this.terminal.fit(), 100);
        }
    }

    // 隐藏窗口
    hide() {
        this.windowElement.style.display = 'none';
        this.isVisible = false;
    }

    // 最小化
    minimize() {
        const windowBody = this.windowElement.querySelector('.code-window-body');
        const minimizeBtn = this.windowElement.querySelector('.code-btn-minimize i');

        if (this.isMinimized) {
            // 恢复窗口
            windowBody.style.display = 'block';
            this.windowElement.style.height = 'auto';
            this.windowElement.style.minHeight = '400px';
            minimizeBtn.className = 'fas fa-minus';
            this.isMinimized = false;

            // 重新调整编辑器和终端大小
            setTimeout(() => {
                if (this.editor && this.editor.layout) {
                    this.editor.layout();
                }
                if (this.terminal && this.fitAddon && this.fitAddon.fit) {
                    this.fitAddon.fit();
                }
            }, 100);
        } else {
            // 最小化窗口
            windowBody.style.display = 'none';
            this.windowElement.style.height = 'auto';
            this.windowElement.style.minHeight = 'auto';
            minimizeBtn.className = 'fas fa-window-maximize';
            this.isMinimized = true;
        }
    }



    // 获取当前代码
    getCode() {
        return this.editor ? this.editor.getValue() : '';
    }

    // 设置代码
    setCode(code) {
        if (this.editor) {
            this.editor.setValue(code);
        }
    }

    // 插入代码
    insertCode(code, position = null) {
        if (!this.editor) return;

        if (position) {
            this.editor.executeEdits('ai-insert', [{
                range: new monaco.Range(position.line, position.column, position.line, position.column),
                text: code
            }]);
        } else {
            const selection = this.editor.getSelection();
            this.editor.executeEdits('ai-insert', [{
                range: selection,
                text: code
            }]);
        }
    }

    // 获取选中的代码
    getSelectedCode() {
        if (!this.editor) return '';

        const selection = this.editor.getSelection();
        if (selection.isEmpty()) {
            return this.editor.getValue();
        }

        return this.editor.getModel().getValueInRange(selection);
    }

    // 销毁编辑器
    destroy() {
        try {
            // 清理编辑器
            if (this.editor && this.editor.dispose) {
                this.editor.dispose();
            }

            // 清理终端
            if (this.terminal && this.terminal.dispose) {
                this.terminal.dispose();
            }

            // 清理执行引擎
            if (this.executionEngine && this.executionEngine.dispose) {
                this.executionEngine.dispose();
            }

            // 移除DOM元素
            if (this.windowElement && this.windowElement.parentNode) {
                this.windowElement.parentNode.removeChild(this.windowElement);
            }

            console.log('Code Editor Window destroyed:', this.id);
        } catch (error) {
            console.error('Error destroying editor:', error);
        }
    }

    // 设置全局错误处理
    setupGlobalErrorHandling() {
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.warn('未处理的Promise拒绝:', event.reason);
            // 阻止默认的错误处理，避免在控制台显示
            event.preventDefault();
        });

        // 捕获全局错误
        window.addEventListener('error', (event) => {
            // 忽略一些已知的无害错误
            const ignoredErrors = [
                'Can only have one anonymous define call per script file',
                'Duplicate definition of module',
                'Failed to load resource',
                'X.default.parse is not a function'
            ];

            const errorMessage = event.message || event.error?.message || '';
            const shouldIgnore = ignoredErrors.some(ignored => errorMessage.includes(ignored));

            if (shouldIgnore) {
                console.warn('忽略已知错误:', errorMessage);
                event.preventDefault();
                return;
            }

            console.error('全局错误:', event.error || event.message);
        });
    }

    // 初始化调整大小功能
    initializeResizers() {
        console.log('Initializing resizers for editor:', this.id);

        // 延迟初始化，确保DOM完全创建
        setTimeout(() => {
            this.initializeSidebarResizer();
            this.initializeTerminalResizer();
            this.initializeAIPanelResizer();
        }, 100);
    }

    // 初始化侧边栏调整大小
    initializeSidebarResizer() {
        const resizer = document.getElementById(`sidebarResizer-${this.id}`);
        const sidebar = document.getElementById(`sidebar-${this.id}`);
        const editorArea = this.windowElement.querySelector('.code-editor-area');

        if (!resizer || !sidebar || !editorArea) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);

            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            this.windowElement.classList.add('resizing');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));

            sidebar.style.width = newWidth + 'px';
            this.sidebarWidth = newWidth;

            // 触发编辑器重新布局
            if (this.editor && this.editor.layout) {
                setTimeout(() => this.editor.layout(), 0);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                this.windowElement.classList.remove('resizing');

                // 保存侧边栏宽度
                localStorage.setItem(`code-editor-sidebar-width-${this.id}`, this.sidebarWidth);
            }
        });
    }

    // 初始化终端调整大小
    initializeTerminalResizer() {
        const resizer = document.getElementById(`terminalResizer-${this.id}`);
        const bottomPanel = this.windowElement.querySelector('.code-bottom-panel');
        const mainArea = this.windowElement.querySelector('.code-main-area');

        console.log('Terminal resizer initialization:', {
            resizer: !!resizer,
            bottomPanel: !!bottomPanel,
            mainArea: !!mainArea,
            resizerId: `terminalResizer-${this.id}`
        });

        if (!resizer || !bottomPanel || !mainArea) {
            console.warn('Terminal resizer elements not found:', { resizer, bottomPanel, mainArea });
            return;
        }

        console.log('Terminal resizer bound successfully');

        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = parseInt(window.getComputedStyle(bottomPanel).height, 10);

            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
            this.windowElement.classList.add('resizing');
            e.preventDefault();

            console.log('Terminal resize started:', { startY, startHeight });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = startY - e.clientY; // 向上拖拽增加高度
            const newHeight = Math.max(150, Math.min(500, startHeight + deltaY));

            bottomPanel.style.height = newHeight + 'px';
            this.terminalHeight = newHeight;

            console.log('Terminal resizing:', { deltaY, newHeight });

            // 触发终端和编辑器重新布局
            setTimeout(() => {
                if (this.terminal && this.fitAddon && this.fitAddon.fit) {
                    this.fitAddon.fit();
                }
                if (this.editor && this.editor.layout) {
                    this.editor.layout();
                }
            }, 10);
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                this.windowElement.classList.remove('resizing');

                console.log('Terminal resize ended, new height:', this.terminalHeight);

                // 保存终端高度
                localStorage.setItem(`code-editor-terminal-height-${this.id}`, this.terminalHeight);
            }
        });
    }

    // 初始化AI面板调整大小
    initializeAIPanelResizer() {
        const resizer = document.getElementById(`aiResizer-${this.id}`);
        const aiPanel = document.getElementById(`aiPanel-${this.id}`);
        const fileSection = this.windowElement.querySelector('.sidebar-section:first-child');
        const sidebar = document.getElementById(`sidebar-${this.id}`);

        console.log('AI panel resizer initialization:', {
            resizer: !!resizer,
            aiPanel: !!aiPanel,
            fileSection: !!fileSection,
            sidebar: !!sidebar,
            resizerId: `aiResizer-${this.id}`
        });

        if (!resizer || !aiPanel || !fileSection || !sidebar) {
            console.warn('AI panel resizer elements not found:', { resizer, aiPanel, fileSection, sidebar });
            return;
        }

        console.log('AI panel resizer bound successfully');

        let isResizing = false;
        let startY = 0;
        let startAIHeight = 0;
        let startFileHeight = 0;
        let sidebarTotalHeight = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startAIHeight = parseInt(window.getComputedStyle(aiPanel).height, 10) || this.aiPanelHeight;
            startFileHeight = parseInt(window.getComputedStyle(fileSection).height, 10);
            sidebarTotalHeight = parseInt(window.getComputedStyle(sidebar).height, 10);

            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
            this.windowElement.classList.add('resizing');
            e.preventDefault();

            console.log('AI panel resize started:', { startY, startAIHeight, startFileHeight, sidebarTotalHeight });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;

            // 修复拖拽方向：向上拖拽增加AI面板高度，向下拖拽减少AI面板高度
            const newAIHeight = Math.max(150, startAIHeight - deltaY); // 反转deltaY方向，移除上限
            const actualDelta = newAIHeight - startAIHeight;
            const newFileHeight = Math.max(30, startFileHeight + deltaY); // 允许文件区域被压缩到极小

            // 应用新高度
            aiPanel.style.height = newAIHeight + 'px';
            fileSection.style.height = newFileHeight + 'px';

            // 确保flex布局正确
            fileSection.style.flex = 'none';
            aiPanel.style.flex = 'none';

            this.aiPanelHeight = newAIHeight;

            console.log('AI panel resizing:', { newAIHeight, newFileHeight, deltaY: -deltaY, actualDelta });
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                this.windowElement.classList.remove('resizing');

                console.log('AI panel resize ended, new height:', this.aiPanelHeight);

                // 保存AI面板高度
                localStorage.setItem(`code-editor-ai-panel-height-${this.id}`, this.aiPanelHeight);
            }
        });
    }

    // 保存当前文件
    saveCurrentFile() {
        if (this.editor && this.currentFile) {
            const content = this.editor.getValue();

            // 更新文件树中的内容
            if (this.fileTree.has(this.currentFile)) {
                const fileData = this.fileTree.get(this.currentFile);
                fileData.content = content;
                this.fileTree.set(this.currentFile, fileData);
            }

            // 调用保存回调
            if (this.onSave && typeof this.onSave === 'function') {
                this.onSave(content);
            }

            Utils.showNotification('文件已保存', 'success');
        }
    }

    // 绑定键盘快捷键
    bindKeyboardShortcuts() {
        this.windowElement.addEventListener('keydown', (e) => {
            // Ctrl+S 保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveCurrentFile();
            }

            // Ctrl+R 运行代码
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.runCode();
            }
        });
    }

    // 关闭窗口
    close() {
        // 停止执行
        if (this.isExecuting) {
            this.stopExecution();
        }

        // 调用关闭回调
        if (this.onClose && typeof this.onClose === 'function') {
            this.onClose();
        }

        // 隐藏窗口
        this.hide();

        // 清理资源
        this.destroy();
    }

    // 绑定底部面板标签页事件
    bindTerminalTabEvents() {
        const terminalTabs = this.windowElement.querySelectorAll('.terminal-tab');
        terminalTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTerminalTab(tab.dataset.terminal);
            });
        });
    }

    // 切换底部面板标签页
    switchTerminalTab(tabType) {
        // 更新标签页状态
        const terminalTabs = this.windowElement.querySelectorAll('.terminal-tab');
        terminalTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.terminal === tabType) {
                tab.classList.add('active');
            }
        });

        // 显示对应面板
        const terminalPanels = this.windowElement.querySelectorAll('.terminal-panel');
        terminalPanels.forEach(panel => {
            panel.style.display = 'none';
        });

        const targetPanel = this.windowElement.querySelector(`#${tabType}-${this.id}`);
        if (targetPanel) {
            targetPanel.style.display = 'block';

            // 如果是终端面板，确保终端正确显示
            if (tabType === 'terminal' && this.terminal) {
                setTimeout(() => {
                    this.terminal.fit();
                }, 100);
            }
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.CodeEditorWindow = CodeEditorWindow;
}
