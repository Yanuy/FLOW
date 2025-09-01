/**
 * 网页浏览器交互节点
 * 支持网页浏览、搜索、内容分析
 */

class BrowserNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.browserWindow = null;
        this.searchResults = null;
    }

    getDefaultConfig() {
        return {
            autoOpen: true,
            defaultUrl: 'https://www.bing.com',
            searchEngine: 'bing', // bing, google, baidu
            enableAI: true,
            outputFormat: 'text', // text, json, html
            maxResults: 10
        };
    }

    getNodeInfo() {
        return {
            title: '网页浏览器',
            icon: 'fas fa-globe',
            description: '智能网页浏览和搜索',
            inputs: ['query', 'url', 'trigger'],
            outputs: ['content', 'results', 'title', 'url']
        };
    }

    getNodeContentHTML() {
        return `
            <div class="browser-node-content">
                <div class="node-info">
                    <div class="info-item">
                        <span class="label">搜索引擎:</span>
                        <span class="value">${this.config.searchEngine.toUpperCase()}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">AI助手:</span>
                        <span class="value">${this.config.enableAI ? '启用' : '禁用'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    async execute(inputs) {
        try {
            // 如果没有浏览器窗口，创建一个
            if (!this.browserWindow) {
                this.createBrowserWindow();
            }

            let result = {};

            if (inputs.query) {
                // 执行搜索
                result = await this.performSearch(inputs.query);
            } else if (inputs.url) {
                // 加载指定URL
                result = await this.loadUrl(inputs.url);
            } else {
                // 获取当前页面内容
                result = this.getCurrentContent();
            }

            return {
                content: result.content || '',
                results: result.searchResults || [],
                title: result.title || '',
                url: result.url || ''
            };

        } catch (error) {
            console.error('浏览器节点执行失败:', error);
            return {
                error: error.message,
                content: '',
                results: [],
                title: '',
                url: ''
            };
        }
    }

    // 创建浏览器窗口
    createBrowserWindow() {
        this.browserWindow = new BrowserWindow({
            id: `browser-${this.id}`,
            title: `浏览器 - ${this.id}`,
            position: { x: 200, y: 150 },
            size: { width: 1200, height: 800 }
        });

        // 设置回调
        this.browserWindow.onClose = () => {
            this.browserWindow = null;
        };

        this.browserWindow.onSearch = (query, url) => {
            console.log(`浏览器节点 ${this.id} 搜索:`, query, url);
        };

        this.browserWindow.onPageLoad = (tab) => {
            console.log(`浏览器节点 ${this.id} 页面加载:`, tab.title, tab.url);
        };

        this.browserWindow.show();
    }

    // 执行搜索
    async performSearch(query) {
        if (!this.browserWindow) {
            this.createBrowserWindow();
        }

        const result = await this.browserWindow.performSearch(query);
        this.searchResults = result;

        return result;
    }

    // 加载URL
    async loadUrl(url) {
        if (!this.browserWindow) {
            this.createBrowserWindow();
        }

        await this.browserWindow.loadPage(url);

        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 2000));

        return this.browserWindow.getCurrentPageContent();
    }

    // 获取当前内容
    getCurrentContent() {
        if (!this.browserWindow) {
            return {
                content: '',
                title: '',
                url: '',
                searchResults: []
            };
        }

        return this.browserWindow.getCurrentPageContent() || {
            content: '',
            title: '',
            url: '',
            searchResults: []
        };
    }



    // 双击打开浏览器
    onDoubleClick(e) {
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }

        if (!this.browserWindow) {
            this.createBrowserWindow();
        } else {
            this.browserWindow.show();
        }
    }

    // 获取节点状态信息
    getStatusInfo() {
        const hasWindow = !!this.browserWindow;
        const currentContent = this.getCurrentContent();

        return {
            hasWindow,
            currentUrl: currentContent.url,
            currentTitle: currentContent.title,
            hasSearchResults: !!(this.searchResults && this.searchResults.searchResults.length > 0),
            searchResultsCount: this.searchResults ? this.searchResults.searchResults.length : 0
        };
    }

    // 清理资源
    destroy() {
        if (this.browserWindow) {
            this.browserWindow.close();
            this.browserWindow = null;
        }
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.BrowserNode = BrowserNode;
}
