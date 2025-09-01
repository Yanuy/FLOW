/**
 * 网页浏览器窗口组件
 * 支持多标签页、智能助手、网页内容分析
 */

class BrowserWindow {
    constructor(options = {}) {
        this.id = options.id || `browser_${Date.now()}`;
        this.title = options.title || '智能浏览器';
        this.position = options.position || { x: 100, y: 100 };
        this.size = options.size || { width: 1200, height: 800 };

        // 浏览器状态
        this.tabs = new Map();
        this.activeTabId = null;
        this.tabCounter = 0;

        // AI助手状态
        this.isAIMode = true;
        this.aiAssistant = null;

        // 窗口状态
        this.isMinimized = false;

        // 回调函数
        this.onClose = null;
        this.onSearch = null;
        this.onPageLoad = null;

        // 创建窗口
        this.createWindow();
        this.initialize();
    }

    // 创建窗口HTML结构
    createWindow() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'browser-window';
        this.windowElement.id = this.id;
        this.windowElement.style.cssText = `
            position: fixed;
            left: ${this.position.x}px;
            top: ${this.position.y}px;
            width: ${this.size.width}px;
            height: ${this.size.height}px;
            z-index: 1000;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        this.windowElement.innerHTML = `
            <!-- 窗口标题栏 -->
            <div class="browser-header">
                <div class="browser-title">
                    <i class="fas fa-globe"></i>
                    <span class="title-text">${this.title}</span>
                </div>
                <div class="browser-controls">
                    <button class="browser-btn browser-btn-ai" id="aiBtn-${this.id}" title="AI助手">
                        <i class="fas fa-robot"></i>
                    </button>
                    <button class="browser-btn browser-btn-minimize" title="最小化">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="browser-btn browser-btn-close" title="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <!-- 浏览器工具栏 -->
            <div class="browser-toolbar">
                <div class="browser-navigation">
                    <button class="nav-btn" id="backBtn-${this.id}" title="后退">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <button class="nav-btn" id="forwardBtn-${this.id}" title="前进">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                    <button class="nav-btn" id="refreshBtn-${this.id}" title="刷新">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
                <div class="browser-address-bar">
                    <input type="text" id="addressBar-${this.id}" placeholder="搜索或输入网址..." value="https://www.bing.com">
                    <button class="search-btn" id="searchBtn-${this.id}">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                <div class="browser-actions">
                    <button class="action-btn" id="newTabBtn-${this.id}" title="新建标签页">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
            
            <!-- 标签页栏 -->
            <div class="browser-tabs" id="browserTabs-${this.id}">
                <!-- 标签页将动态添加 -->
                <div class="webapp-shortcuts">
                    <div class="webapp-item" data-url="https://vscode.dev" data-title="VS Code" title="在线VS Code">
                        VS Code
                    </div>
                    <div class="webapp-item" data-url="https://github.com" data-title="GitHub" title="GitHub">
                        GitHub
                    </div>
                </div>
            </div>
            
            <div class="browser-body">
                <!-- 主要内容区 -->
                <div class="browser-main">
                    <!-- 网页内容区 -->
                    <div class="browser-content" id="browserContent-${this.id}">
                        <!-- 标签页内容将动态添加 -->
                    </div>
                    
                    <!-- AI助手侧边栏 -->
                    <div class="browser-sidebar" id="browserSidebar-${this.id}">
                        <div class="sidebar-header">
                            <h4>AI网页助手</h4>
                            <button class="sidebar-btn" id="aiCloseBtn-${this.id}" title="关闭AI">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <!-- 快速操作 -->
                        <div class="quick-actions">
                            <button class="quick-btn" id="summarizeBtn-${this.id}">
                                <i class="fas fa-file-alt"></i>
                                <span>总结网页</span>
                            </button>
                            <button class="quick-btn" id="extractBtn-${this.id}">
                                <i class="fas fa-list"></i>
                                <span>提取要点</span>
                            </button>
                            <button class="quick-btn" id="translateBtn-${this.id}">
                                <i class="fas fa-language"></i>
                                <span>翻译页面</span>
                            </button>
                            <button class="quick-btn" id="searchPageBtn-${this.id}">
                                <i class="fas fa-search-plus"></i>
                                <span>页面搜索</span>
                            </button>
                        </div>
                        
                        <!-- AI对话区 -->
                        <div class="ai-chat-area">
                            <div class="ai-messages" id="aiMessages-${this.id}">
                                <div class="ai-welcome">
                                    <i class="fas fa-robot"></i>
                                    <p>我是AI网页助手，可以帮您：</p>
                                    <ul>
                                        <li>总结和分析网页内容</li>
                                        <li>回答关于页面的问题</li>
                                        <li>搜索相关信息</li>
                                        <li>翻译和解释内容</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="ai-input-area">
                                <input type="text" id="aiInput-${this.id}" placeholder="询问关于这个网页的问题...">
                                <button id="aiSendBtn-${this.id}">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.windowElement);
    }

    // 初始化浏览器
    async initialize() {
        this.bindEvents();
        this.makeDraggable();
        this.createDefaultTab();
        this.initializeAI();

        console.log('Browser Window initialized:', this.id);
    }

    // 绑定事件
    bindEvents() {
        // 窗口控制
        this.windowElement.querySelector('.browser-btn-minimize').addEventListener('click', () => this.minimize());
        this.windowElement.querySelector('.browser-btn-close').addEventListener('click', () => this.close());

        // AI助手
        document.getElementById(`aiBtn-${this.id}`).addEventListener('click', () => this.toggleAI());
        document.getElementById(`aiCloseBtn-${this.id}`).addEventListener('click', () => this.closeAI());
        document.getElementById(`aiSendBtn-${this.id}`).addEventListener('click', () => this.sendAIMessage());

        // 浏览器导航
        document.getElementById(`backBtn-${this.id}`).addEventListener('click', () => this.goBack());
        document.getElementById(`forwardBtn-${this.id}`).addEventListener('click', () => this.goForward());
        document.getElementById(`refreshBtn-${this.id}`).addEventListener('click', () => this.refresh());
        document.getElementById(`searchBtn-${this.id}`).addEventListener('click', () => this.search());
        document.getElementById(`newTabBtn-${this.id}`).addEventListener('click', () => this.createNewTab());

        // 地址栏回车搜索
        const addressBar = document.getElementById(`addressBar-${this.id}`);
        addressBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.search();
            }
        });

        // AI输入回车发送
        const aiInput = document.getElementById(`aiInput-${this.id}`);
        aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendAIMessage();
            }
        });

        // 快速操作按钮
        document.getElementById(`summarizeBtn-${this.id}`).addEventListener('click', () => this.summarizePage());
        document.getElementById(`extractBtn-${this.id}`).addEventListener('click', () => this.extractKeyPoints());
        document.getElementById(`translateBtn-${this.id}`).addEventListener('click', () => this.translatePage());
        document.getElementById(`searchPageBtn-${this.id}`).addEventListener('click', () => this.searchInPage());

        // 设置AI按钮初始状态
        const aiBtn = document.getElementById(`aiBtn-${this.id}`);
        if (aiBtn && this.isAIMode) {
            aiBtn.classList.add('active');
        }

        // WebApp快捷栏事件
        this.bindWebAppEvents();
    }

    // 创建默认标签页
    createDefaultTab() {
        this.createNewTab('https://www.bing.com', 'Bing');
    }

    // 创建新标签页
    createNewTab(url = 'https://www.bing.com', title = '新标签页') {
        const tabId = `tab_${++this.tabCounter}`;

        // 创建标签页数据
        const tab = {
            id: tabId,
            url: url,
            title: title,
            history: [url],
            historyIndex: 0,
            content: '',
            loading: false
        };

        this.tabs.set(tabId, tab);

        // 创建标签页UI
        this.createTabUI(tab);
        this.createTabContent(tab);

        // 激活新标签页
        this.switchTab(tabId);

        // 加载页面
        this.loadPage(url, tabId);

        return tabId;
    }

    // 创建标签页UI
    createTabUI(tab) {
        const tabsContainer = document.getElementById(`browserTabs-${this.id}`);

        const tabElement = document.createElement('div');
        tabElement.className = 'browser-tab';
        tabElement.dataset.tabId = tab.id;
        tabElement.innerHTML = `
            <div class="tab-favicon">
                <i class="fas fa-globe"></i>
            </div>
            <span class="tab-title">${tab.title}</span>
            <button class="tab-close" title="关闭标签页">
                <i class="fas fa-times"></i>
            </button>
        `;

        // 绑定标签页事件
        tabElement.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) {
                this.closeTab(tab.id);
            } else {
                this.switchTab(tab.id);
            }
        });

        tabsContainer.appendChild(tabElement);
    }

    // 创建标签页内容
    createTabContent(tab) {
        const contentContainer = document.getElementById(`browserContent-${this.id}`);

        const contentElement = document.createElement('div');
        contentElement.className = 'tab-content';
        contentElement.dataset.tabId = tab.id;
        contentElement.style.display = 'none';
        contentElement.innerHTML = `
            <div class="page-loading" style="display: none;">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在加载...</span>
            </div>
            <iframe class="page-frame" src="about:blank" sandbox="allow-scripts allow-forms allow-popups"></iframe>
            <div class="page-error" style="display: none;">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>页面加载失败</h3>
                <p>无法加载此页面，请检查网址或网络连接。</p>
                <button class="retry-btn">重试</button>
            </div>
        `;

        contentContainer.appendChild(contentElement);
    }

    // 显示窗口
    show() {
        this.windowElement.style.display = 'flex';
    }

    // 隐藏窗口
    hide() {
        this.windowElement.style.display = 'none';
    }

    // 最小化窗口
    minimize() {
        const windowBody = this.windowElement.querySelector('.browser-body');
        const minimizeBtn = this.windowElement.querySelector('.browser-btn-minimize i');

        if (this.isMinimized) {
            // 恢复窗口
            windowBody.style.display = 'flex';
            this.windowElement.style.height = this.size.height + 'px';
            minimizeBtn.className = 'fas fa-minus';
            this.isMinimized = false;
        } else {
            // 最小化窗口
            windowBody.style.display = 'none';
            this.windowElement.style.height = '48px'; // 只显示标题栏
            minimizeBtn.className = 'fas fa-window-maximize';
            this.isMinimized = true;
        }
    }

    // 关闭窗口
    close() {
        if (this.onClose && typeof this.onClose === 'function') {
            this.onClose();
        }

        this.windowElement.remove();
    }

    // 使窗口可拖拽
    makeDraggable() {
        const header = this.windowElement.querySelector('.browser-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = this.position.x;
        let yOffset = this.position.y;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.browser-controls')) return;

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
            this.windowElement.style.zIndex = '1000';
        });
    }

    // 切换标签页
    switchTab(tabId) {
        // 更新标签页状态
        const tabs = this.windowElement.querySelectorAll('.browser-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tabId === tabId) {
                tab.classList.add('active');
            }
        });

        // 显示对应内容
        const contents = this.windowElement.querySelectorAll('.tab-content');
        contents.forEach(content => {
            content.style.display = 'none';
            if (content.dataset.tabId === tabId) {
                content.style.display = 'block';
            }
        });

        this.activeTabId = tabId;

        // 更新地址栏
        const tab = this.tabs.get(tabId);
        if (tab) {
            const addressBar = document.getElementById(`addressBar-${this.id}`);
            addressBar.value = tab.url;
        }
    }

    // 关闭标签页
    closeTab(tabId) {
        if (this.tabs.size <= 1) {
            // 如果只有一个标签页，关闭整个窗口
            this.close();
            return;
        }

        // 删除标签页数据
        this.tabs.delete(tabId);

        // 删除UI元素
        const tabElement = this.windowElement.querySelector(`[data-tab-id="${tabId}"]`);
        const contentElement = this.windowElement.querySelector(`.tab-content[data-tab-id="${tabId}"]`);

        if (tabElement) tabElement.remove();
        if (contentElement) contentElement.remove();

        // 如果关闭的是当前活动标签页，切换到其他标签页
        if (this.activeTabId === tabId) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchTab(remainingTabs[0]);
            }
        }
    }

    // 加载页面
    async loadPage(url, tabId = null) {
        const currentTabId = tabId || this.activeTabId;
        const tab = this.tabs.get(currentTabId);

        if (!tab) return;

        tab.loading = true;
        tab.url = url;

        // 显示加载状态
        const contentElement = this.windowElement.querySelector(`.tab-content[data-tab-id="${currentTabId}"]`);
        const loadingElement = contentElement.querySelector('.page-loading');
        const frameElement = contentElement.querySelector('.page-frame');
        const errorElement = contentElement.querySelector('.page-error');

        loadingElement.style.display = 'flex';
        frameElement.style.display = 'none';
        errorElement.style.display = 'none';

        try {
            // 模拟页面加载
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 更新iframe src
            frameElement.src = url;

            // 添加iframe错误处理
            frameElement.onerror = () => {
                console.log('iframe加载失败，显示错误页面');
                frameElement.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(`
                    <html>
                    <head><title>页面无法显示</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
                        <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ff9800; margin-bottom: 20px;"></i>
                            <h2>页面无法显示</h2>
                            <p>该网站不允许在框架中显示，这是出于安全考虑。</p>
                            <p><strong>建议：</strong></p>
                            <p>• 在新窗口中打开此网站</p>
                            <p>• 尝试搜索相关内容</p>
                            <p>• 使用右侧AI助手获取帮助</p>
                            <div style="margin-top: 30px;">
                                <a href="${url}" target="_blank" style="background: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">在新窗口打开</a>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            };

            // 模拟页面内容获取
            tab.content = await this.fetchPageContent(url);

            // 更新标签页标题
            const title = this.extractPageTitle(tab.content) || new URL(url).hostname;
            tab.title = title;

            const tabElement = this.windowElement.querySelector(`[data-tab-id="${currentTabId}"]`);
            const titleElement = tabElement.querySelector('.tab-title');
            titleElement.textContent = title;

            // 显示页面内容
            loadingElement.style.display = 'none';
            frameElement.style.display = 'block';

            tab.loading = false;

            // 触发页面加载回调
            if (this.onPageLoad) {
                this.onPageLoad(tab);
            }

        } catch (error) {
            console.error('页面加载失败:', error);

            loadingElement.style.display = 'none';
            errorElement.style.display = 'flex';

            tab.loading = false;
        }
    }

    // 获取页面内容（模拟）
    async fetchPageContent(url) {
        // 由于跨域限制，这里模拟页面内容获取
        // 实际应用中需要通过后端代理或浏览器扩展API

        if (url === 'about:blank') {
            return `
                <html>
                <head><title>新标签页</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
                    <h1>智能浏览器</h1>
                    <p>在地址栏中输入网址或搜索关键词开始浏览</p>
                    <div style="margin-top: 30px;">
                        <p><strong>提示：</strong></p>
                        <p>• 输入网址直接访问</p>
                        <p>• 输入关键词进行搜索</p>
                        <p>• 使用右侧AI助手分析页面内容</p>
                    </div>
                </body>
                </html>
            `;
        }

        if (url.includes('bing.com/search')) {
            return `
                <html>
                <head><title>搜索结果</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>搜索结果</h1>
                    <p>这是模拟的搜索结果页面。</p>
                    <div style="margin-top: 20px;">
                        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                            <h3 style="color: #1a0dab;">搜索结果1</h3>
                            <p style="color: #006621;">https://example1.com</p>
                            <p>这是第一个搜索结果的描述内容...</p>
                        </div>
                        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                            <h3 style="color: #1a0dab;">搜索结果2</h3>
                            <p style="color: #006621;">https://example2.com</p>
                            <p>这是第二个搜索结果的描述内容...</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
        }

        return `
            <html>
            <head><title>页面预览</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9;">
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h1>页面内容预览</h1>
                    <p><strong>URL:</strong> ${url}</p>
                    <p>由于浏览器安全限制，某些网站无法在iframe中显示。</p>
                    <p>这是模拟的页面内容，用于演示AI助手功能。</p>
                    <div style="margin-top: 30px; padding: 20px; background: #f0f8ff; border-radius: 5px;">
                        <h3>AI助手功能</h3>
                        <p>• 总结页面内容</p>
                        <p>• 提取关键信息</p>
                        <p>• 翻译页面文本</p>
                        <p>• 回答相关问题</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // 提取页面标题
    extractPageTitle(html) {
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        return titleMatch ? titleMatch[1] : null;
    }

    // 搜索
    search() {
        const addressBar = document.getElementById(`addressBar-${this.id}`);
        const query = addressBar.value.trim();

        if (!query) return;

        let url;
        if (query.startsWith('http://') || query.startsWith('https://')) {
            url = query;
        } else if (query.includes('.') && !query.includes(' ')) {
            url = `https://${query}`;
        } else {
            // 使用Bing搜索
            url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        }

        this.loadPage(url);

        // 触发搜索回调
        if (this.onSearch) {
            this.onSearch(query, url);
        }
    }

    // 后退
    goBack() {
        const tab = this.tabs.get(this.activeTabId);
        if (tab && tab.historyIndex > 0) {
            tab.historyIndex--;
            const url = tab.history[tab.historyIndex];
            this.loadPage(url);
        }
    }

    // 前进
    goForward() {
        const tab = this.tabs.get(this.activeTabId);
        if (tab && tab.historyIndex < tab.history.length - 1) {
            tab.historyIndex++;
            const url = tab.history[tab.historyIndex];
            this.loadPage(url);
        }
    }

    // 刷新
    refresh() {
        const tab = this.tabs.get(this.activeTabId);
        if (tab) {
            this.loadPage(tab.url);
        }
    }

    // 初始化AI助手
    initializeAI() {
        // AI助手初始化逻辑
        console.log('AI助手已初始化');
    }

    // 切换AI助手
    toggleAI() {
        const sidebar = document.getElementById(`browserSidebar-${this.id}`);
        const aiBtn = document.getElementById(`aiBtn-${this.id}`);

        if (this.isAIMode) {
            sidebar.style.display = 'none';
            aiBtn.classList.remove('active');
            this.isAIMode = false;
        } else {
            sidebar.style.display = 'block';
            aiBtn.classList.add('active');
            this.isAIMode = true;
        }
    }

    // 关闭AI助手
    closeAI() {
        const sidebar = document.getElementById(`browserSidebar-${this.id}`);
        const aiBtn = document.getElementById(`aiBtn-${this.id}`);

        sidebar.style.display = 'none';
        aiBtn.classList.remove('active');
        this.isAIMode = false;
    }

    // 发送AI消息
    async sendAIMessage() {
        const input = document.getElementById(`aiInput-${this.id}`);
        const message = input.value.trim();

        if (!message) return;

        // 添加用户消息
        this.addAIMessage(message, 'user');
        input.value = '';

        // 获取当前页面内容
        const currentTab = this.tabs.get(this.activeTabId);
        const pageContent = currentTab ? currentTab.content : '';

        // 模拟AI响应
        setTimeout(() => {
            const response = this.generateAIResponse(message, pageContent);
            this.addAIMessage(response, 'assistant');
        }, 1000);
    }

    // 添加AI消息
    addAIMessage(message, type) {
        const messagesContainer = document.getElementById(`aiMessages-${this.id}`);

        const messageElement = document.createElement('div');
        messageElement.className = `ai-message ${type}`;

        if (type === 'user') {
            messageElement.innerHTML = `
                <div class="message-content user-message">
                    <i class="fas fa-user"></i>
                    <span>${message}</span>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-content assistant-message">
                    <i class="fas fa-robot"></i>
                    <div class="message-text">${this.formatAIMessage(message)}</div>
                </div>
            `;
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 格式化AI消息
    formatAIMessage(message) {
        return message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    // 生成AI响应
    generateAIResponse(message, pageContent) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('总结') || lowerMessage.includes('摘要')) {
            return '**页面总结：**\n\n根据当前页面内容，这是一个网页浏览器界面。主要功能包括：\n\n• 多标签页浏览\n• 智能搜索功能\n• AI助手集成\n• 页面内容分析\n\n如需更详细的分析，请告诉我您关注的具体方面。';
        }

        if (lowerMessage.includes('搜索') || lowerMessage.includes('查找')) {
            return '**搜索建议：**\n\n我可以帮您在当前页面中搜索信息，或者建议相关的搜索关键词。请告诉我您想要搜索的具体内容。';
        }

        if (lowerMessage.includes('翻译')) {
            return '**翻译功能：**\n\n我可以帮您翻译页面内容。请指定您需要翻译的文本或整个页面，以及目标语言。';
        }

        return `我理解您的问题："${message}"。基于当前页面内容，我建议您可以：\n\n• 使用页面搜索功能查找相关信息\n• 尝试不同的搜索关键词\n• 浏览相关链接获取更多信息\n\n还有什么我可以帮助您的吗？`;
    }

    // 总结页面
    async summarizePage() {
        const currentTab = this.tabs.get(this.activeTabId);
        if (!currentTab) return;

        this.addAIMessage('请总结当前页面的主要内容', 'user');

        setTimeout(() => {
            const summary = `**页面总结：**\n\n**标题：** ${currentTab.title}\n**网址：** ${currentTab.url}\n\n**主要内容：**\n• 这是一个${currentTab.url.includes('bing.com') ? 'Bing搜索引擎' : '网页'}页面\n• 提供了搜索和浏览功能\n• 包含相关的信息和链接\n\n**建议操作：**\n• 可以进行进一步的搜索\n• 浏览相关链接获取更多信息`;

            this.addAIMessage(summary, 'assistant');
        }, 1000);
    }

    // 提取要点
    async extractKeyPoints() {
        this.addAIMessage('请提取当前页面的关键要点', 'user');

        setTimeout(() => {
            const keyPoints = `**关键要点：**\n\n1. **主要功能**\n   • 网页浏览和搜索\n   • 多标签页管理\n   • AI助手支持\n\n2. **用户界面**\n   • 直观的导航控件\n   • 智能搜索栏\n   • 侧边栏AI助手\n\n3. **智能特性**\n   • 自动页面分析\n   • 内容总结功能\n   • 智能搜索建议`;

            this.addAIMessage(keyPoints, 'assistant');
        }, 1000);
    }

    // 翻译页面
    async translatePage() {
        this.addAIMessage('请翻译当前页面内容', 'user');

        setTimeout(() => {
            const translation = `**翻译功能：**\n\n我可以帮您翻译页面内容到以下语言：\n\n• 中文 ↔ 英文\n• 中文 ↔ 日文\n• 中文 ↔ 韩文\n• 中文 ↔ 法文\n• 中文 ↔ 德文\n\n请告诉我您需要翻译的具体内容和目标语言。`;

            this.addAIMessage(translation, 'assistant');
        }, 1000);
    }

    // 页面内搜索
    async searchInPage() {
        this.addAIMessage('请在当前页面中搜索内容', 'user');

        setTimeout(() => {
            const searchHelp = `**页面搜索：**\n\n我可以帮您在当前页面中搜索：\n\n• **文本内容** - 查找特定词汇或短语\n• **链接地址** - 找到相关链接\n• **图片描述** - 搜索图片相关信息\n• **标题内容** - 查找章节标题\n\n请告诉我您要搜索的关键词。`;

            this.addAIMessage(searchHelp, 'assistant');
        }, 1000);
    }

    // 获取当前页面内容（用于节点输出）
    getCurrentPageContent() {
        const currentTab = this.tabs.get(this.activeTabId);
        if (!currentTab) return null;

        return {
            url: currentTab.url,
            title: currentTab.title,
            content: currentTab.content,
            timestamp: new Date().toISOString()
        };
    }

    // 执行搜索并返回结果（用于节点功能）
    async performSearch(query) {
        // 执行搜索
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        await this.loadPage(searchUrl);

        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 返回搜索结果
        const currentTab = this.tabs.get(this.activeTabId);
        return {
            query: query,
            url: searchUrl,
            title: currentTab ? currentTab.title : 'Search Results',
            content: currentTab ? currentTab.content : '',
            searchResults: this.extractSearchResults(currentTab ? currentTab.content : ''),
            timestamp: new Date().toISOString()
        };
    }

    // 提取搜索结果
    extractSearchResults(html) {
        // 模拟搜索结果提取
        return [
            {
                title: '搜索结果1',
                url: 'https://example1.com',
                snippet: '这是第一个搜索结果的摘要内容...'
            },
            {
                title: '搜索结果2',
                url: 'https://example2.com',
                snippet: '这是第二个搜索结果的摘要内容...'
            },
            {
                title: '搜索结果3',
                url: 'https://example3.com',
                snippet: '这是第三个搜索结果的摘要内容...'
            }
        ];
    }

    // 绑定WebApp快捷栏事件
    bindWebAppEvents() {
        const webappItems = this.windowElement.querySelectorAll('.webapp-item');
        webappItems.forEach(item => {
            item.addEventListener('click', () => {
                const url = item.dataset.url;
                const title = item.dataset.title;
                this.createNewTab(url, title);
            });
        });
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.BrowserWindow = BrowserWindow;
}
