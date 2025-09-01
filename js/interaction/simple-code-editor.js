// 简化版代码编辑器 - 避免复杂依赖问题
class SimpleCodeEditor {
    constructor(config = {}) {
        this.id = config.id || Utils.generateId('simple_code_');
        this.title = config.title || 'Simple Code Editor';
        this.language = config.language || 'javascript';
        this.position = config.position || { x: 100, y: 100 };
        this.size = config.size || { width: 800, height: 600 };

        this.isVisible = false;
        this.windowElement = null;
        this.editorElement = null;
        this.outputElement = null;

        this.createWindow();
        this.bindEvents();
        this.show();
    }

    createWindow() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'simple-code-editor';
        this.windowElement.style.cssText = `
            position: fixed;
            left: ${this.position.x}px;
            top: ${this.position.y}px;
            width: ${this.size.width}px;
            height: ${this.size.height}px;
            background: #1e1e1e;
            border: 1px solid #3c3c3c;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            flex-direction: column;
            overflow: hidden;
        `;

        this.windowElement.innerHTML = `
            <div class="editor-header" style="
                background: #2d2d2d;
                padding: 12px 16px;
                border-bottom: 1px solid #3c3c3c;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
            ">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-code" style="color: #007acc;"></i>
                    <span style="color: #cccccc; font-weight: 500;">${this.title}</span>
                    <span style="color: #888; font-size: 12px;">[${this.language.toUpperCase()}]</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="run-btn" title="运行代码 (Ctrl+Enter)" style="
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        <i class="fas fa-play"></i> 运行
                    </button>
                    <button class="clear-btn" title="清空输出" style="
                        background: #666;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="close-btn" title="关闭" style="
                        background: #e74c3c;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div style="display: flex; flex: 1; overflow: hidden;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div style="background: #252525; padding: 8px 16px; border-bottom: 1px solid #3c3c3c;">
                        <span style="color: #cccccc; font-size: 12px;">代码编辑器</span>
                    </div>
                    <textarea class="code-editor" style="
                        flex: 1;
                        background: #1e1e1e;
                        color: #d4d4d4;
                        border: none;
                        padding: 16px;
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        font-size: 14px;
                        line-height: 1.5;
                        resize: none;
                        outline: none;
                        tab-size: 4;
                    " placeholder="在此输入${this.language}代码...">${this.getDefaultCode()}</textarea>
                </div>
                
                <div style="width: 40%; display: flex; flex-direction: column; border-left: 1px solid #3c3c3c;">
                    <div style="background: #252525; padding: 8px 16px; border-bottom: 1px solid #3c3c3c;">
                        <span style="color: #cccccc; font-size: 12px;">输出结果</span>
                    </div>
                    <div class="code-output" style="
                        flex: 1;
                        background: #1a1a1a;
                        color: #d4d4d4;
                        padding: 16px;
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        font-size: 13px;
                        line-height: 1.4;
                        overflow-y: auto;
                        white-space: pre-wrap;
                    ">准备运行代码...</div>
                </div>
            </div>
            
            <div class="editor-status" style="
                background: #007acc;
                color: white;
                padding: 6px 16px;
                font-size: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>就绪</span>
                <span>按 Ctrl+Enter 运行代码</span>
            </div>
        `;

        document.body.appendChild(this.windowElement);

        this.editorElement = this.windowElement.querySelector('.code-editor');
        this.outputElement = this.windowElement.querySelector('.code-output');
        this.statusElement = this.windowElement.querySelector('.editor-status span');

        this.makeDraggable();
    }

    bindEvents() {
        // 运行按钮
        this.windowElement.querySelector('.run-btn').addEventListener('click', () => {
            this.runCode();
        });

        // 清空按钮
        this.windowElement.querySelector('.clear-btn').addEventListener('click', () => {
            this.clearOutput();
        });

        // 关闭按钮
        this.windowElement.querySelector('.close-btn').addEventListener('click', () => {
            this.close();
        });

        // 键盘快捷键
        this.editorElement.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.runCode();
            }

            // Tab键插入4个空格
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.editorElement.selectionStart;
                const end = this.editorElement.selectionEnd;
                const value = this.editorElement.value;
                this.editorElement.value = value.substring(0, start) + '    ' + value.substring(end);
                this.editorElement.selectionStart = this.editorElement.selectionEnd = start + 4;
            }
        });
    }

    makeDraggable() {
        const header = this.windowElement.querySelector('.editor-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = this.position.x;
        let yOffset = this.position.y;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;

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

    show() {
        this.windowElement.style.display = 'flex';
        this.isVisible = true;
        this.editorElement.focus();
    }

    hide() {
        this.windowElement.style.display = 'none';
        this.isVisible = false;
    }

    close() {
        this.hide();
        if (this.windowElement.parentNode) {
            this.windowElement.parentNode.removeChild(this.windowElement);
        }
    }

    getCode() {
        return this.editorElement.value;
    }

    setCode(code) {
        this.editorElement.value = code;
    }

    getDefaultCode() {
        const defaults = {
            javascript: `// JavaScript 示例代码
console.log("欢迎使用简化代码编辑器！");

// 计算斐波那契数列
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
    console.log(\`fibonacci(\${i}) = \${fibonacci(i)}\`);
}

// 数组操作示例
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(x => x * 2);
console.log("原数组:", numbers);
console.log("翻倍后:", doubled);`,

            python: `# Python 示例代码
print("欢迎使用简化代码编辑器！")

# 计算斐波那契数列
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

for i in range(10):
    print(f"fibonacci({i}) = {fibonacci(i)}")

# 列表操作示例
numbers = [1, 2, 3, 4, 5]
doubled = [x * 2 for x in numbers]
print("原列表:", numbers)
print("翻倍后:", doubled)`,

            html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML 示例</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .card {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <h1>🚀 欢迎使用 HTML 编辑器</h1>
    <div class="card">
        <h2>功能特性</h2>
        <ul>
            <li>实时 HTML 预览</li>
            <li>内联 CSS 支持</li>
            <li>JavaScript 交互</li>
        </ul>
    </div>
    
    <script>
        console.log("HTML 页面已加载！");
        document.querySelector('h1').addEventListener('click', function() {
            this.style.color = '#' + Math.floor(Math.random()*16777215).toString(16);
        });
    </script>
</body>
</html>`
        };

        return defaults[this.language] || '// 开始编写代码...';
    }

    async runCode() {
        const code = this.getCode();
        if (!code.trim()) {
            this.appendOutput('错误: 请输入代码');
            return;
        }

        this.clearOutput();
        this.updateStatus('运行中...');

        try {
            if (this.language === 'javascript') {
                await this.runJavaScript(code);
            } else if (this.language === 'python') {
                await this.runPython(code);
            } else if (this.language === 'html') {
                this.runHTML(code);
            } else {
                this.appendOutput(`暂不支持 ${this.language} 语言执行`);
            }
        } catch (error) {
            this.appendOutput(`执行错误: ${error.message}`, 'error');
        } finally {
            this.updateStatus('就绪');
        }
    }

    async runJavaScript(code) {
        // 捕获console.log输出
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        const outputs = [];

        console.log = (...args) => {
            outputs.push(['log', args.join(' ')]);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            outputs.push(['error', args.join(' ')]);
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            outputs.push(['warn', args.join(' ')]);
            originalWarn.apply(console, args);
        };

        try {
            // 使用 Function 构造器执行代码
            const func = new Function(code);
            const result = func();

            if (result !== undefined) {
                outputs.push(['result', `返回值: ${JSON.stringify(result)}`]);
            }

            // 输出所有捕获的内容
            if (outputs.length === 0) {
                this.appendOutput('代码执行完成，无输出');
            } else {
                outputs.forEach(([type, message]) => {
                    this.appendOutput(message, type);
                });
            }

        } catch (error) {
            this.appendOutput(`运行时错误: ${error.message}`, 'error');
        } finally {
            // 恢复原始console方法
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        }
    }

    async runPython(code) {
        // 简化的Python执行 - 实际项目中需要Pyodide
        this.appendOutput('Python 执行需要 Pyodide 环境');
        this.appendOutput('代码将被模拟执行:');
        this.appendOutput(code, 'code');
        this.appendOutput('注意: 这是模拟输出，实际需要集成 Pyodide');
    }

    runHTML(code) {
        // 在新窗口中打开HTML预览
        const newWindow = window.open('', '_blank', 'width=800,height=600');
        newWindow.document.write(code);
        newWindow.document.close();

        this.appendOutput('HTML 页面已在新窗口中打开');
        this.appendOutput('预览窗口已创建，请查看新打开的标签页');
    }

    clearOutput() {
        this.outputElement.textContent = '';
    }

    appendOutput(message, type = 'info') {
        const colors = {
            log: '#d4d4d4',
            info: '#569cd6',
            warn: '#dcdcaa',
            error: '#f44747',
            result: '#4fc1ff',
            code: '#ce9178'
        };

        const color = colors[type] || colors.info;
        const timestamp = new Date().toLocaleTimeString();

        const line = document.createElement('div');
        line.style.color = color;
        line.style.marginBottom = '4px';
        line.innerHTML = `<span style="color: #888; font-size: 11px;">[${timestamp}]</span> ${message}`;

        this.outputElement.appendChild(line);
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    updateStatus(status) {
        this.statusElement.textContent = status;
    }
}

// 简化版代码编辑器管理器
class SimpleCodeEditorManager {
    constructor() {
        this.editors = new Map();
        this.addToolbarButton();
    }

    addToolbarButton() {
        // 如果工具栏存在，添加按钮
        const toolbar = document.querySelector('.toolbar') || document.querySelector('.header-controls');
        if (toolbar) {
            const button = document.createElement('button');
            button.className = 'toolbar-btn';
            button.innerHTML = '<i class="fas fa-code"></i> 代码编辑器';
            button.title = '打开代码编辑器';
            button.addEventListener('click', () => this.createEditor());
            toolbar.appendChild(button);
        }
    }

    createEditor(config = {}) {
        const editor = new SimpleCodeEditor({
            language: config.language || 'javascript',
            title: config.title || 'Simple Code Editor',
            position: this.getNextPosition(),
            ...config
        });

        this.editors.set(editor.id, editor);
        return editor;
    }

    getNextPosition() {
        const count = this.editors.size;
        return {
            x: 100 + (count * 30),
            y: 100 + (count * 30)
        };
    }
}

// 全局实例
if (typeof window !== 'undefined') {
    window.SimpleCodeEditor = SimpleCodeEditor;
    window.SimpleCodeEditorManager = SimpleCodeEditorManager;

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.simpleCodeEditorManager = new SimpleCodeEditorManager();
        });
    } else {
        window.simpleCodeEditorManager = new SimpleCodeEditorManager();
    }
}
