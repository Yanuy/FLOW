// 代码执行引擎 - 支持多语言代码执行
class CodeExecutionEngine {
    constructor(language = 'javascript') {
        this.language = language;
        this.isInitialized = false;
        this.isRunning = false;

        // 执行环境
        this.pythonEnv = null;
        this.jsWorker = null;
        this.htmlPreview = null;

        // 事件回调
        this.outputHandlers = [];
        this.errorHandlers = [];
        this.completeHandlers = [];

        // 执行历史
        this.executionHistory = [];
        this.currentSession = null;
    }

    // 初始化执行环境
    async initialize() {
        console.log(`初始化${this.language}执行环境...`);

        try {
            switch (this.language) {
                case 'python':
                    await this.initializePython();
                    break;
                case 'javascript':
                    await this.initializeJavaScript();
                    break;
                case 'html':
                    await this.initializeHTML();
                    break;
                case 'json':
                    await this.initializeJSON();
                    break;
                default:
                    throw new Error(`不支持的语言: ${this.language}`);
            }

            this.isInitialized = true;
            this.emitOutput(`\x1b[32m${this.language.toUpperCase()} 执行环境已就绪\x1b[0m\n`);

        } catch (error) {
            this.emitError(`初始化失败: ${error.message}`);
            throw error;
        }
    }

    // 初始化Python环境
    async initializePython() {
        if (window.pyodide) {
            this.pythonEnv = window.pyodide;
        } else {
            // 加载Pyodide
            this.emitOutput('正在加载Python环境，请稍候...\n');

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
            document.head.appendChild(script);

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });

            // 初始化Pyodide
            this.pythonEnv = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
                stdout: (text) => this.emitOutput(text),
                stderr: (text) => this.emitError(text)
            });

            // 安装常用包
            await this.pythonEnv.loadPackage(['numpy', 'matplotlib', 'pandas']);

            // 设置matplotlib后端
            this.pythonEnv.runPython(`
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64

def show_plot():
    """显示matplotlib图形"""
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', bbox_inches='tight', dpi=150)
    buffer.seek(0)
    image_png = buffer.getvalue()
    buffer.close()
    plt.close()
    
    encoded = base64.b64encode(image_png).decode('utf-8')
    print(f"__PLOT__{encoded}__PLOT__")

# 重写show函数
plt.show = show_plot
            `);
        }
    }

    // 初始化JavaScript环境
    async initializeJavaScript() {
        // 创建安全的JavaScript执行环境
        this.jsWorker = new Worker(URL.createObjectURL(new Blob([`
            // JavaScript Worker执行环境
            let console = {
                log: (...args) => {
                    postMessage({
                        type: 'output',
                        data: args.map(arg => 
                            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                        ).join(' ') + '\\n'
                    });
                },
                error: (...args) => {
                    postMessage({
                        type: 'error',
                        data: args.map(arg => String(arg)).join(' ')
                    });
                },
                warn: (...args) => {
                    postMessage({
                        type: 'output',
                        data: '⚠️ ' + args.map(arg => String(arg)).join(' ') + '\\n'
                    });
                },
                info: (...args) => {
                    postMessage({
                        type: 'output',
                        data: 'ℹ️ ' + args.map(arg => String(arg)).join(' ') + '\\n'
                    });
                }
            };
            
            // 添加一些实用函数
            function sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
            
            function fetch(...args) {
                return self.fetch(...args);
            }
            
            onmessage = async function(e) {
                try {
                    const { code, command } = e.data;
                    
                    if (command) {
                        // 执行命令
                        eval(command);
                    } else if (code) {
                        // 执行代码
                        const result = eval(code);
                        
                        if (result instanceof Promise) {
                            const resolved = await result;
                            if (resolved !== undefined) {
                                console.log(resolved);
                            }
                        } else if (result !== undefined) {
                            console.log(result);
                        }
                    }
                    
                    postMessage({ type: 'complete' });
                    
                } catch (error) {
                    postMessage({
                        type: 'error',
                        data: error.message
                    });
                    postMessage({ type: 'complete' });
                }
            };
        `], { type: 'application/javascript' })));

        this.jsWorker.onmessage = (e) => {
            const { type, data } = e.data;

            switch (type) {
                case 'output':
                    this.emitOutput(data);
                    break;
                case 'error':
                    this.emitError(data);
                    break;
                case 'complete':
                    this.emitComplete();
                    break;
            }
        };

        this.jsWorker.onerror = (error) => {
            this.emitError(`Worker错误: ${error.message}`);
            this.emitComplete();
        };
    }

    // 初始化HTML环境
    async initializeHTML() {
        // HTML执行通过iframe预览实现
        this.htmlPreview = null;
    }

    // 初始化JSON环境
    async initializeJSON() {
        // JSON环境主要用于配置编辑和验证
        console.log('JSON环境已就绪');
    }

    // 执行代码
    async execute(code) {
        if (!this.isInitialized) {
            throw new Error('执行环境未初始化');
        }

        if (this.isRunning) {
            throw new Error('代码正在执行中');
        }

        this.isRunning = true;
        this.currentSession = {
            id: Utils.generateId('session_'),
            code: code,
            language: this.language,
            startTime: Date.now(),
            status: 'running'
        };

        this.emitOutput(`\x1b[36m执行 ${this.language} 代码...\x1b[0m\n`);

        try {
            switch (this.language) {
                case 'python':
                    await this.executePython(code);
                    break;
                case 'javascript':
                    await this.executeJavaScript(code);
                    break;
                case 'html':
                    await this.executeHTML(code);
                    break;
                default:
                    throw new Error(`不支持执行 ${this.language} 代码`);
            }

            this.currentSession.status = 'completed';
            this.currentSession.endTime = Date.now();
            this.executionHistory.push(this.currentSession);

        } catch (error) {
            this.currentSession.status = 'error';
            this.currentSession.error = error.message;
            this.currentSession.endTime = Date.now();
            this.executionHistory.push(this.currentSession);

            this.emitError(error.message);
        } finally {
            this.isRunning = false;
            this.emitComplete();
        }
    }

    // 执行Python代码
    async executePython(code) {
        if (!this.pythonEnv) {
            throw new Error('Python环境未初始化');
        }

        try {
            // 捕获输出
            this.pythonEnv.runPython(`
import sys
from io import StringIO

# 保存原始stdout
original_stdout = sys.stdout
original_stderr = sys.stderr

# 创建字符串缓冲区
stdout_buffer = StringIO()
stderr_buffer = StringIO()

# 重定向输出
sys.stdout = stdout_buffer
sys.stderr = stderr_buffer
            `);

            // 执行用户代码
            const result = this.pythonEnv.runPython(code);

            // 获取输出
            const stdout = this.pythonEnv.runPython('stdout_buffer.getvalue()');
            const stderr = this.pythonEnv.runPython('stderr_buffer.getvalue()');

            // 恢复原始输出
            this.pythonEnv.runPython(`
sys.stdout = original_stdout
sys.stderr = original_stderr
            `);

            // 输出结果
            if (stdout) {
                // 检查是否有matplotlib图形
                if (stdout.includes('__PLOT__')) {
                    const plotMatches = stdout.match(/__PLOT__([^_]+)__PLOT__/g);
                    let cleanOutput = stdout;

                    if (plotMatches) {
                        plotMatches.forEach(match => {
                            const base64Data = match.replace(/__PLOT__/g, '');
                            this.emitOutput(`\n📊 生成图形:\n`);
                            this.emitOutput(`<img src="data:image/png;base64,${base64Data}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0;">\n`);
                            cleanOutput = cleanOutput.replace(match, '');
                        });
                    }

                    if (cleanOutput.trim()) {
                        this.emitOutput(cleanOutput);
                    }
                } else {
                    this.emitOutput(stdout);
                }
            }

            if (stderr) {
                this.emitError(stderr);
            }

            // 如果有返回值且不是None，显示它
            if (result !== undefined && result !== null && result.toString() !== 'None') {
                this.emitOutput(`📤 返回值: ${result}\n`);
            }

        } catch (error) {
            throw new Error(`Python执行错误: ${error.message}`);
        }
    }

    // 执行JavaScript代码
    async executeJavaScript(code) {
        if (!this.jsWorker) {
            throw new Error('JavaScript环境未初始化');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('执行超时'));
            }, 30000); // 30秒超时

            const originalComplete = this.emitComplete;
            this.emitComplete = () => {
                clearTimeout(timeout);
                this.emitComplete = originalComplete;
                resolve();
            };

            this.jsWorker.postMessage({ code });
        });
    }

    // 执行HTML代码
    async executeHTML(code) {
        // 创建预览窗口
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        if (!previewWindow) {
            throw new Error('无法打开预览窗口，请检查弹窗阻止设置');
        }

        // 写入HTML内容
        previewWindow.document.open();
        previewWindow.document.write(code);
        previewWindow.document.close();

        this.emitOutput('✅ HTML页面已在新窗口中打开\n');
    }

    // 执行终端命令
    async executeCommand(command) {
        this.emitOutput(`> ${command}\n`);

        // 解析命令
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'clear':
            case 'cls':
                // 清空由终端自己处理
                break;

            case 'help':
                this.emitOutput(`
可用命令:
  help          - 显示帮助信息
  clear/cls     - 清空终端
  history       - 显示执行历史
  install <pkg> - 安装Python包 (仅Python环境)
  version       - 显示版本信息
  env           - 显示环境信息
  run           - 运行当前编辑器中的代码
`);
                break;

            case 'history':
                this.emitOutput('执行历史:\n');
                this.executionHistory.forEach((session, index) => {
                    const duration = session.endTime ? session.endTime - session.startTime : 0;
                    this.emitOutput(`${index + 1}. [${session.status}] ${session.language} (${duration}ms)\n`);
                });
                break;

            case 'install':
                if (this.language === 'python' && this.pythonEnv) {
                    const packageName = args[0];
                    if (!packageName) {
                        this.emitError('请指定要安装的包名');
                        return;
                    }

                    this.emitOutput(`正在安装 ${packageName}...\n`);
                    try {
                        await this.pythonEnv.loadPackage([packageName]);
                        this.emitOutput(`✅ ${packageName} 安装成功\n`);
                    } catch (error) {
                        this.emitError(`❌ 安装失败: ${error.message}`);
                    }
                } else {
                    this.emitError('install命令仅在Python环境中可用');
                }
                break;

            case 'version':
                this.emitOutput(`代码执行引擎 v1.0.0\n当前语言: ${this.language}\n`);
                break;

            case 'env':
                this.emitOutput(`执行环境信息:\n`);
                this.emitOutput(`- 语言: ${this.language}\n`);
                this.emitOutput(`- 状态: ${this.isInitialized ? '已初始化' : '未初始化'}\n`);
                this.emitOutput(`- 运行中: ${this.isRunning ? '是' : '否'}\n`);
                if (this.language === 'python' && this.pythonEnv) {
                    this.emitOutput(`- Python版本: ${this.pythonEnv.version}\n`);
                }
                break;

            case 'run':
                this.emitOutput('请使用运行按钮或 Ctrl+R 执行代码\n');
                break;

            default:
                // 尝试作为代码执行
                if (this.language === 'python' && this.pythonEnv) {
                    try {
                        await this.executePython(command);
                    } catch (error) {
                        this.emitError(`未知命令: ${cmd}. 输入 'help' 查看可用命令`);
                    }
                } else if (this.language === 'javascript' && this.jsWorker) {
                    try {
                        this.jsWorker.postMessage({ command });
                    } catch (error) {
                        this.emitError(`未知命令: ${cmd}. 输入 'help' 查看可用命令`);
                    }
                } else {
                    this.emitError(`未知命令: ${cmd}. 输入 'help' 查看可用命令`);
                }
                break;
        }
    }

    // 停止执行
    stop() {
        if (this.isRunning) {
            if (this.jsWorker) {
                this.jsWorker.terminate();
                this.initializeJavaScript(); // 重新初始化worker
            }

            this.isRunning = false;
            if (this.currentSession) {
                this.currentSession.status = 'stopped';
                this.currentSession.endTime = Date.now();
            }

            this.emitOutput('\n\x1b[33m执行已停止\x1b[0m\n');
            this.emitComplete();
        }
    }

    // 事件处理
    onOutput(handler) {
        this.outputHandlers.push(handler);
    }

    onError(handler) {
        this.errorHandlers.push(handler);
    }

    onComplete(handler) {
        this.completeHandlers.push(handler);
    }

    // 发出输出事件
    emitOutput(data) {
        this.outputHandlers.forEach(handler => handler(data));
    }

    // 发出错误事件
    emitError(error) {
        this.errorHandlers.forEach(handler => handler(error));
    }

    // 发出完成事件
    emitComplete() {
        this.completeHandlers.forEach(handler => handler());
    }

    // 获取执行历史
    getExecutionHistory() {
        return this.executionHistory;
    }

    // 清空执行历史
    clearExecutionHistory() {
        this.executionHistory = [];
    }

    // 销毁执行环境
    destroy() {
        this.stop();

        if (this.jsWorker) {
            this.jsWorker.terminate();
            this.jsWorker = null;
        }

        this.pythonEnv = null;
        this.htmlPreview = null;
        this.outputHandlers = [];
        this.errorHandlers = [];
        this.completeHandlers = [];
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.CodeExecutionEngine = CodeExecutionEngine;
}
